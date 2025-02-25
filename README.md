# Candidate Application

A modern web application for managing candidate information built with Next.js.

## Project Description

This application serves as a comprehensive platform for tracking and managing job candidates throughout the recruitment process. Users can:

- View a dashboard of all candidates with sorting and filtering capabilities
- Add new candidates with detailed profile information
- Generate reports on hiring metrics

The application uses a modern tech stack with server-side rendering for optimal performance and SEO, while providing a seamless user experience through client-side interactions.

## Features

- Candidate profile management
- Application tracking
- Interactive dashboard
- User authentication

## Technologies Used

- [Next.js](https://nextjs.org/) - React framework
- TypeScript
- Tailwind CSS for styling
- API Routes for backend functionality
- Next.js App Router

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or yarn

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# API Keys
NEXT_PUBLIC_API_URL=your_api_url_here
API_KEY=your_api_key_here

# Authentication
AUTH_SECRET=your_auth_secret_here
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=your_database_connection_string

# Other Services
MAIL_SERVICE_API_KEY=your_mail_service_key
```

Make sure to replace the placeholder values with your actual credentials. Never commit the `.env.local` file to version control.

### Installation

```bash
# Clone the repository
git clone <your-repo-url>

# Navigate to the project directory
cd candidate-app

# Install dependencies
npm install
# or
yarn install
```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## How It Works

1. **Authentication**: Users sign in through NextAuth.js integration
2. **Dashboard**: The main interface displays candidate cards with key information
3. **Candidate Management**:
   - Add new candidates through a multi-step form
   - Update candidate status with a drag-and-drop interface
   - View detailed profiles with application history
4. **Interview Scheduling**: Calendar integration for scheduling and notifications
5. **Analytics**: Real-time metrics on hiring pipeline and conversion rates

## Project Structure

```
candidate-app/
├── app/               # Next.js App Router
│   ├── admin/         # Admin dashboard pages
│   ├── api/           # API routes for backend functionality
│   ├── layout.tsx     # Root layout component
│   └── page.tsx       # Homepage component
├── components/        # Reusable UI components
│   ├── CandidateForm.tsx  # Form for candidate submissions
│   ├── Navbar.tsx     # Navigation component
│   └── ResumeSearch.tsx   # AI-powered resume search component
├── data/              # Sample data and schemas
│   ├── candidates.json  # Candidate information
│   └── jobs.json      # Job listings
├── lib/               # Utility functions and shared code
│   ├── dataStore.js   # Data persistence functions
│   ├── embeddings.js  # Vector embedding generation
│   └── pinecone.js    # Pinecone database client
├── public/            # Static assets
└── .env.local         # Environment variables (not committed to git)
```

## Deployment

The application can be deployed on [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js) with minimal configuration:

1. Push your code to a GitHub repository
2. Import your repository to Vercel
3. Configure environment variables in the Vercel dashboard
4. Deploy

## Troubleshooting

1. Missing Environment Variables: Ensure all required variables in .**env.local** are correctly set
2. Pinecone Connection Issues: Verify your Pinecone API key and environment settings
3. Build Errors: Make sure all dependencies are installed with **npm install**
