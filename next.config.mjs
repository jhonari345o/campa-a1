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
    AGENT_WORKER_TOKEN: process.env.AGENT_WORKER_TOKEN,
    AGENT_TRIGGER_URL: process.env.AGENT_TRIGGER_URL,
    // Motor de pauta real (se encienden al pegar las llaves).
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  },
};

export default nextConfig;
