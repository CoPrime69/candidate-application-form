import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { getEmbedding } from "./embeddings";
import pineconeIndex from "./pinecone";

// Define file paths for storing data
const dataDir = path.join(process.cwd(), 'data');
const candidatesFile = path.join(dataDir, 'candidates.json');
const jobsFile = path.join(dataDir, 'jobs.json');

// Ensure data directory exists
try {
  fs.mkdirSync(dataDir, { recursive: true });
} catch (error) {
  // Directory already exists or can't be created
  console.error("Error creating data directory:", error);
}

// Helper function to read data from a file
async function readData(filePath, defaultData = []) {
  try {
    const fileExists = fs.existsSync(filePath);
    if (!fileExists) {
      await fsPromises.writeFile(filePath, JSON.stringify(defaultData));
      return defaultData;
    }
    
    const data = await fsPromises.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading data from ${filePath}:`, error);
    return defaultData;
  }
}

// Helper function to write data to a file
async function writeData(filePath, data) {
  try {
    await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing data to ${filePath}:`, error);
    throw error;
  }
}

// Candidate data operations
export async function getCandidates() {
  return readData(candidatesFile);
}

export async function saveCandidates(candidates) {
  await writeData(candidatesFile, candidates);
}

export async function addCandidate(candidate) {
  const candidates = await getCandidates();
  candidates.push(candidate);
  await saveCandidates(candidates);
  await indexCandidateInPinecone(candidate); // Add this line
  return candidate;
}

export async function indexCandidateInPinecone(candidate) {
  try {
    const candidateText = `
      Name: ${candidate.name || ''}
      Skills: ${candidate.skills || ''}
      Experience: ${candidate.experience || ''}
      Resume: ${candidate.resumeText || ''}
    `;
    
    const embedding = await getEmbedding(candidateText);
    
    await pineconeIndex.upsert([
      {
        id: `candidate_${candidate.id}`,
        values: embedding,
        metadata: {
          type: 'candidate',
          name: candidate.name,
          skills: candidate.skills,
          experience: candidate.experience
        }
      }
    ]);
    
    console.log(`Candidate ${candidate.id} indexed in Pinecone`);
    return true;
  } catch (error) {
    console.error(`Error indexing candidate ${candidate.id}:`, error);
    return false;
  }
}

// Job data operations
export async function getJobs() {
  return readData(jobsFile, [
    {
      id: 1,
      title: "Frontend Developer",
      description: "We're looking for a React expert to join our team.",
      requirements: "3+ years experience with React, TypeScript, and modern frontend tools.",
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      title: "Backend Engineer",
      description: "Seeking a skilled Node.js developer for our backend team.",
      requirements: "Experience with Node.js, Express, and database technologies. Knowledge of AWS services.",
      createdAt: new Date().toISOString()
    }
  ]);
}

export async function saveJobs(jobs) {
  await writeData(jobsFile, jobs);
}

export async function addJob(job) {
  const jobs = await getJobs();
  jobs.push(job);
  await saveJobs(jobs);
  return job;
}

// Helper to get the next available ID
export async function getNextCandidateId() {
  const candidates = await getCandidates();
  return candidates.length > 0 
    ? Math.max(...candidates.map(c => c.id)) + 1 
    : 1;
}

export async function getNextJobId() {
  const jobs = await getJobs();
  return jobs.length > 0 
    ? Math.max(...jobs.map(j => j.id)) + 1 
    : 1;
}