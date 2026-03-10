import dotenv from 'dotenv';

dotenv.config();

export const config = {
  node_env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.BACKEND_PORT || '3000', 10),
  log_level: process.env.LOG_LEVEL || 'info',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/aicsa_db',
    pool_size: parseInt(process.env.DB_POOL_SIZE || '20', 10),
    timeout: parseInt(process.env.DB_TIMEOUT || '5000', 10),
  },

  vector_db: {
    provider: process.env.VECTOR_DB_PROVIDER || 'pinecone',
    pinecone: {
      api_key: process.env.PINECONE_API_KEY || '',
      environment: process.env.PINECONE_ENVIRONMENT || 'us-west-2',
      index_name: process.env.PINECONE_INDEX_NAME || 'aicsa-prod',
    },
  },

  llm: {
    provider: process.env.LLM_PROVIDER || 'openai',
    openai: {
      api_key: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
      embedding_model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    },
    ollama: {
      api_url: process.env.OLLAMA_API_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'mistral',
      embedding_model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    },
  },

  auth: {
    jwt_secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_at_least_32_chars_long',
    jwt_expiry: parseInt(process.env.JWT_EXPIRY || '900', 10),
    refresh_token_expiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY || '604800', 10),
  },

  email: {
    smtp_host: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtp_port: parseInt(process.env.SMTP_PORT || '587', 10),
    smtp_user: process.env.SMTP_USER || '',
    smtp_pass: process.env.SMTP_PASS || '',
    escalation_email: process.env.ESCALATION_EMAIL || 'support@company.com',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
  },

  rag: {
    retrieval_top_k: parseInt(process.env.RETRIEVAL_TOP_K || '5', 10),
    confidence_threshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.6'),
    max_context_tokens: parseInt(process.env.MAX_CONTEXT_TOKENS || '2000', 10),
    chunk_size: parseInt(process.env.CHUNK_SIZE || '1000', 10),
    chunk_overlap: parseInt(process.env.CHUNK_OVERLAP || '200', 10),
  },

  upload: {
    max_file_size_mb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    upload_dir: process.env.UPLOAD_DIR || './uploads',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3001').split(','),
  },
};
