import { NextResponse } from "next/server";
import { getJobs, saveJobs, addJob, getNextJobId } from "@/lib/dataStore";
import { getEmbedding } from "@/lib/embeddings";
import pineconeIndex from "@/lib/pinecone";

// Initialize by storing jobs in Pinecone
(async () => {
  try {
    const jobs = await getJobs();
    
    for (const job of jobs) {
      const jobText = `
        Title: ${job.title}
        Description: ${job.description}
        Requirements: ${job.requirements}
      `;
      
      const embedding = await getEmbedding(jobText);
      
      await pineconeIndex.upsert([
        {
          id: `job_${job.id}`,
          values: embedding,
          metadata: {
            type: 'job',
            // other metadata fields
          }
        }
      ]);
    }
    console.log('Jobs initialized in Pinecone');
  } catch (error) {
    console.error('Error initializing jobs:', error);
  }
})();

// GET all jobs
export async function GET() {
  const jobs = await getJobs();
  return NextResponse.json(jobs);
}

// POST (create) a new job
export async function POST(request) {
  try {
    const { title, description, requirements } = await request.json();
    
    if (!title || !description || !requirements) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const id = await getNextJobId();
    const job = {
      id,
      title,
      description,
      requirements,
      createdAt: new Date().toISOString()
    };
    
    await addJob(job);
    
    return NextResponse.json({
      success: true,
      message: "Job created successfully",
      job
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating job", details: error.message },
      { status: 500 }
    );
  }
}