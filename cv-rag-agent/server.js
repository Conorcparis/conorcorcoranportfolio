const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { createClient } = require('@supabase/supabase-js');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client (for vector storage)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Your CV content as documents
const cvDocuments = [
  {
    title: "Professional Experience",
    content: `
      Sales & Marketing Director | AI & Digital Strategy
      Direct Distribution, Paris, France (Oct 2006 – May 2024)
      - Delivered 15%+ YoY growth; built pipeline with 800+ clients across 12 regions
      - Designed & implemented 5 CRM systems with integrated forecasting tools
      - Launched 60+ products via full Go-To-Market strategies
      - Managed €2.2M+ annual targets; created playbooks & performance dashboards
      - Built & led 30+ team members with 90%+ retention rate
      - Led rapid pivot from B2B distribution to consumer-facing e-commerce platform
      - Implemented AI-driven forecasting agents and marketing automation
      - Grew business from startup to €30M+ turnover over fifteen years

      Sales and Key Accounts Manager | Brand Expansion | National Sales
      Brasseries Kronenbourg, Paris, France (September 2001 – March 2004)
      - Spearheaded the national rollout of Foster's and Carlsberg across 1,000+ on-trade outlets
      - Managed regional account teams, pricing structures, and promotional campaigns
      - Increased brand visibility through events, training programs, and POS strategy

      Junior Consultant
      PwC, Dublin, Ireland (1995 – 1996)
      - Worked in import-export practice
      - Gained experience in consulting environment
    `
  },
  {
    title: "Education",
    content: `
      BSc in Management
      Dublin Institute of Technology (1996)
      - Core MBA modules—strategy, finance, operations, organizational behavior

      Diploma in Marketing
      Dublin Institute of Technology (1996)
    `
  },
  {
    title: "Certifications",
    content: `
      IBM AI Developer Professional Certificate
      IBM (2024–2025)
      - AI application development
      - Generative AI integration
      - Python, JavaScript, HTML/CSS
      - Sales reporting AI agent

      Generative AI Leadership & Strategy Specialization
      Vanderbilt University (2024)
      - AI strategy
      - Business transformation
      - Productivity acceleration
      - Executive AI integration

      Data Analytics in AI
      Jedha Bootcamp, Paris (2024)
      - Data processing
      - Visualization
      - AI-powered decision making
    `
  },
  {
    title: "Skills",
    content: `
      Technical Skills:
      - Python, JavaScript, TypeScript, HTML/CSS
      - OpenAI, IBM Watson, CRM Systems, Mailchimp
      - Docker, CI/CD, GitHub Actions
      
      Business Capabilities:
      - B2B Sales, Enterprise Sales, CRM Management
      - Team Development, Cross-Functional Management, Strategic Planning
      - Digital Campaigns, Brand Launches, Market Research
      
      Languages:
      - English (Native)
      - French (Fluent)
    `
  },
  {
    title: "Career Summary",
    content: `
      Growth-focused leader with over 20 years of experience across consulting, banking, and FMCG. 
      Navigated the full spectrum of business—from Big Four consulting and banking to niche importers and direct-to-consumer ventures.
      In 2000, relocated to France to deepen language skills.
      In 2001, started managing key accounts and trade-marketing for Brasseries Kronenbourg.
      A twelve-month stint in Australia followed, identifying an opportunity to bring Anglo-Irish specialty beverages to the French market.
      Spent a year in business development for small wineries across the U.S. and Europe before launching direct-distribution network in 2006.
      When COVID-19 forced a rethink in 2020, led a rapid pivot from B2B distribution to consumer-facing e-commerce platform with AI integration.
      Currently pivoting into the AI-powered SaaS sector, combining deep industry know-how with cutting-edge technology.
    `
  }
];

// Split documents into chunks for embedding
async function prepareDocuments() {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50
  });
  
  let allChunks = [];
  
  for (const doc of cvDocuments) {
    const chunks = await splitter.splitText(doc.content);
    const processedChunks = chunks.map((chunk, i) => ({
      id: `${doc.title.toLowerCase().replace(/\s+/g, '-')}-${i}`,
      content: chunk,
      section: doc.title
    }));
    
    allChunks = [...allChunks, ...processedChunks];
  }
  
  return allChunks;
}

// Create embeddings and store them
async function createEmbeddings(chunks) {
  for (const chunk of chunks) {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: chunk.content
    });
    
    const [{ embedding }] = embeddingResponse.data;
    
    // Store in Supabase
    await supabase
      .from('cv_embeddings')
      .insert({
        id: chunk.id,
        content: chunk.content,
        embedding,
        section: chunk.section
      });
  }
}

// Initialize the embeddings (run this once)
app.post('/api/init-embeddings', async (req, res) => {
  try {
    const chunks = await prepareDocuments();
    await createEmbeddings(chunks);
    res.json({ success: true, message: 'Embeddings created successfully' });
  } catch (error) {
    console.error('Error creating embeddings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Query the CV with RAG approach
app.post('/api/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    // Create embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query
    });
    
    const [{ embedding }] = embeddingResponse.data;
    
    // Search for similar content in Supabase
    const { data: similarDocuments } = await supabase
      .rpc('match_cv_embeddings', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5
      });
    
    // Extract relevant context
    const context = similarDocuments
      .map(doc => `[${doc.section}] ${doc.content}`)
      .join('\n\n');
    
    // Generate response with RAG
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are Conor's CV Assistant, an AI designed to answer questions about Conor Corcoran's professional background, skills, and qualifications.
          You should provide helpful, accurate, and concise information based on the CV context provided. 
          Always be professional and maintain a friendly tone. If you don't know something, just say so.
          Never make up information not present in the provided context.`
        },
        {
          role: "user",
          content: `Here is the relevant information from Conor's CV:\n\n${context}\n\nBased on this information, please answer the following question: ${query}`
        }
      ]
    });
    
    const answer = completion.choices[0].message.content;
    
    res.json({ answer });
  } catch (error) {
    console.error('Error querying CV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});