import { NextResponse } from "next/server";
import { getCandidates } from "@/lib/dataStore";
import { getEmbedding } from "@/lib/embeddings";
import pineconeIndex from "@/lib/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    console.log("Starting candidate search...");
    const { query, jobId, limit = 10 } = await request.json();
    console.log("Request params:", { query, jobId, limit });
    
    if (!query && !jobId) {
      return NextResponse.json(
        { error: 'Either search query or job ID is required' },
        { status: 400 }
      );
    }
    
    // Determine search text based on input
    let searchText = query;
    let jobRequirements = "";
    
    // If jobId is provided, get job requirements to use as search text
    if (jobId) {
      try {
        const jobResponse = await fetch(`${request.nextUrl.origin}/api/jobs/${jobId}`);
        if (jobResponse.ok) {
          const job = await jobResponse.json();
          jobRequirements = job.requirements;
          searchText = `${job.requirements} ${query || ''}`.trim();
          console.log("Got job requirements:", jobRequirements);
        } else {
          console.error("Failed to fetch job:", await jobResponse.text());
        }
      } catch (jobError) {
        console.error("Error fetching job:", jobError);
      }
    }
    
    if (!searchText) {
      return NextResponse.json(
        { error: 'No valid search text available' },
        { status: 400 }
      );
    }

    console.log("Search text:", searchText);

    // Get all candidates
    console.log("Getting all candidates...");
    const allCandidates = await getCandidates();
    
    try {
      // Attempt vector search
      console.log("Generating embedding for search text...");
      const searchEmbedding = await getEmbedding(searchText);
      console.log("Embedding generated successfully");
      
      console.log("Querying Pinecone index...");
      const searchResults = await pineconeIndex.query({
        vector: searchEmbedding,
        topK: limit * 2,
        filter: { type: 'candidate' },
        includeMetadata: true
      });
      
      console.log("Pinecone search results:", searchResults ? `Found ${searchResults.matches?.length} matches` : "No results");
      
      if (searchResults?.matches?.length > 0) {
        console.log("Processing vector search results...");
        let matchedCandidates = searchResults.matches
          .map(match => {
            const candidateId = parseInt(match.id.replace('candidate_', ''), 10);
            const candidate = allCandidates.find(c => c.id === candidateId);
            
            return candidate ? {
              ...candidate,
              vectorScore: match.score // Store the vector score separately
            } : null;
          })
          .filter(Boolean);
        
        // Rerank with Gemini
        const rankedCandidates = await rerankWithGemini(matchedCandidates, jobRequirements || query, limit);
        console.log("Final candidates with scores:", rankedCandidates.map(c => ({id: c.id, score: c.score})));
        
        return NextResponse.json({ 
          results: rankedCandidates,
          searchMethod: "vector-and-gemini"
        });
      } else {
        console.log("No vector search results, falling back to Gemini only...");
      }
    } catch (vectorError) {
      console.error("Vector search failed:", vectorError);
      console.log("Falling back to Gemini-only approach...");
    }
    
    // Fallback: Use Gemini directly on a subset of candidates
    const candidatesToEvaluate = allCandidates.slice(0, Math.min(allCandidates.length, 15));
    const rankedCandidates = await rerankWithGemini(candidatesToEvaluate, jobRequirements || query, limit);
    console.log("Gemini-only candidates with scores:", rankedCandidates.map(c => ({id: c.id, score: c.score})));
    
    return NextResponse.json({ 
      results: rankedCandidates,
      searchMethod: "gemini-only"
    });
  } catch (error) {
    console.error('Error searching candidates:', error);
    return NextResponse.json(
      { error: "Error searching candidates", details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

// Helper function to rerank candidates with Gemini
async function rerankWithGemini(candidates, requirements, limit) {
  if (!candidates || candidates.length === 0) {
    return [];
  }
  
  try {
    console.log(`Reranking ${candidates.length} candidates with Gemini...`);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const prompt = `
You are an expert HR recruiter evaluating candidate resumes against job requirements.

JOB REQUIREMENTS:
${requirements || "General skills and experience relevant to this role"}

CANDIDATES:
${candidates.map((c, i) => `
CANDIDATE ${i+1}:
ID: ${c.id}
Name: ${c.name}
Skills: ${c.skills}
Experience: ${c.experience}
Resume Text: ${c.resumeText?.substring(0, 800) || "No resume text available"}
`).join('\n')}

Rank these candidates based on their match to the job requirements. For each candidate, provide:
1. A match score from 0.0 to 1.0 (higher is better)
2. A brief explanation of why they match or don't match

Return ONLY valid JSON in exactly this format:
{
  "rankings": [
    {
      "id": 1,
      "score": 0.95,
      "explanation": "Explanation text here"
    },
    ...more candidates
  ]
}
`;
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    });
    
    const text = result.response.text();
    console.log("Gemini response received");
    
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonText = text.substring(jsonStart, jsonEnd);
      console.log("Extracted JSON:", jsonText);
      
      try {
        const rankings = JSON.parse(jsonText);
        console.log("Parsed rankings:", rankings);
        
        if (!rankings.rankings || !Array.isArray(rankings.rankings)) {
          console.error("Invalid rankings format:", rankings);
          return candidates.slice(0, limit);
        }
        
        // Map rankings to candidates
        let rankedCandidates = [];
        
        for (const candidate of candidates) {
          const ranking = rankings.rankings.find(r => r.id === candidate.id);
          if (ranking) {
            rankedCandidates.push({
              ...candidate,
              score: ranking.score,        // Make sure this is included
              explanation: ranking.explanation
            });
          } else {
            // If Gemini didn't rank this candidate, add it with a low score
            rankedCandidates.push({
              ...candidate,
              score: 0.1,
              explanation: "Not specifically ranked by AI"
            });
          }
        }
        
        // Sort by scores
        rankedCandidates.sort((a, b) => b.score - a.score);
        
        // Debug log all scores
        console.log("Ranked candidates scores:", rankedCandidates.map(c => ({id: c.id, name: c.name, score: c.score})));
        
        // Limit to requested number
        rankedCandidates = rankedCandidates.slice(0, limit);
        console.log(`Returning ${rankedCandidates.length} ranked candidates`);
        
        return rankedCandidates;
      } catch (parseError) {
        console.error("Error parsing Gemini JSON:", parseError);
        return candidates.slice(0, limit);
      }
    } else {
      console.error("Could not find valid JSON in Gemini response");
      return candidates.slice(0, limit);
    }
  } catch (aiError) {
    console.error('Error using Gemini for ranking:', aiError);
    // Return the original candidates if Gemini fails
    return candidates.slice(0, limit);
  }
}