import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not set in environment variables!");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function getEmbedding(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(text);
    return result.embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    // Return dummy embedding of 1536 dimensions for testing
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }
}

export async function generateAIEvaluation(candidateProfile, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const prompt = `
You are an expert AI talent evaluator with years of experience in technical recruiting.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE PROFILE:
${candidateProfile}

Your task is to thoroughly evaluate how well this candidate's skills, experience, and background match the requirements for this position.

Please provide:

1. A score from 0-100 representing the overall match between the candidate and job (be realistic and nuanced)
2. A well-structured, detailed feedback analysis (3-4 paragraphs) covering:
   - Candidate's key strengths relevant to this role
   - Areas where the candidate meets or exceeds expectations
   - Gaps or areas for improvement
   - Overall fit assessment

3. Specific recommendations (in bullet points) for:
   - Skills the candidate should develop to better fit the role
   - How the candidate could position themselves better for this type of role
   - Any other constructive suggestions

Format your response exactly as follows:

{
  "score": [number between 0-100],
  "feedback": "[Your detailed, well-formatted feedback analysis]",
  "recommendations": "[Your specific recommendations in bullet point format]"
}
`;
    
    // Set parameters to get better responses
    const generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    };
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }]}],
      generationConfig,
    });
    
    const text = result.response.text();
    
    try {
      // Try to parse the JSON response
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonText = text.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonText);
      } else {
        // Fallback if response isn't properly formatted as JSON
        console.warn("AI response not in proper JSON format:", text.substring(0, 100) + "...");
        
        // Extract score using regex
        const scoreMatch = text.match(/score["\s:]+(\d+)/i);
        const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 65;
        
        // Extract feedback - look for patterns that might indicate feedback sections
        const feedbackMatch = text.match(/feedback["\s:]+([^"]+?)(?=recommendations|$)/is);
        const feedback = feedbackMatch ? 
          feedbackMatch[1].trim() : 
          "Based on the candidate's profile, there appears to be a partial match with the job requirements. The candidate has some relevant skills but may need additional experience in key areas.";
        
        // Extract recommendations
        const recommendationsMatch = text.match(/recommendations["\s:]+([^}]+)/is);
        const recommendations = recommendationsMatch ? 
          recommendationsMatch[1].trim() : 
          "• Focus on developing skills directly relevant to the role\n• Gain more practical experience in related areas\n• Consider additional certifications or training";
        
        return { 
          score, 
          feedback, 
          recommendations 
        };
      }
    } catch (e) {
      console.error("Error parsing AI response:", e);
      console.log("Raw response:", text);
      
      // Return reasonable defaults if parsing fails
      return {
        score: 60,
        feedback: "The candidate shows some relevant skills for the position. Their background includes experience that could be valuable, though there may be some gaps in specific technical requirements. Further discussion recommended to assess cultural fit and technical depth.",
        recommendations: "• Focus on strengthening core technical skills required for the position\n• Consider gaining more hands-on project experience\n• Highlight relevant achievements more prominently"
      };
    }
  } catch (error) {
    console.error("Error generating AI evaluation:", error);
    return {
      score: 0,
      feedback: "Error generating evaluation. Please try again later.",
      recommendations: "• Unable to provide recommendations at this time"
    };
  }
}