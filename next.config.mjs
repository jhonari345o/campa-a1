/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // AWS Amplify no siempre expone las variables de servidor al runtime de
  // Next.js. Las "horneamos" en el build (donde Amplify si las tiene) para que
  // el servidor siempre las encuentre. Solo se usan en codigo de servidor, asi
  // que no se exponen al navegador.
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    BEDROCK_REGION: process.env.BEDROCK_REGION,
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    BEDROCK_ACCESS_KEY_ID: process.env.BEDROCK_ACCESS_KEY_ID,
    BEDROCK_SECRET_ACCESS_KEY: process.env.BEDROCK_SECRET_ACCESS_KEY,
  },
};

export default nextConfig;
