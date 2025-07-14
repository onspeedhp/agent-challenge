# Solana Blockchain Monitor Agent

A comprehensive Solana blockchain monitoring agent built with Mastra that specializes in Anchor program analysis, account monitoring, and transaction tracking. This agent provides deep insights into Solana programs by fetching real-time blockchain data and maintaining conversation context across sessions.

## Agent Description and Purpose

The **Solana Program Expert Agent** is designed to help developers, auditors, and blockchain enthusiasts analyze and monitor Solana Anchor programs effectively. It provides:

- **🔍 Anchor Program Analysis**: Automatically fetch and analyze program IDLs, instructions, account structures, and error codes
- **📊 Account Data Monitoring**: Fetch real-time account data, filter by criteria, and search by public keys
- **🧠 Memory & Context Awareness**: Remembers program IDs and conversation context across sessions
- **🔧 PDA Management**: Derive and validate Program Derived Addresses (PDAs)
- **📈 Comprehensive Reporting**: Detailed analysis with actionable insights and security recommendations

## Project Structure

```
agent-challenge/
├── src/
│   └── mastra/
│       ├── agents/
│       │   └── blockchain-monitor-agent/
│       │       ├── agent.ts
│       │       ├── workflow.ts
│       │       └── tools/
│       │           ├── anchor-program-monitor.ts
│       │           ├── index.ts
│       │           ├── types.ts
│       │           └── utils.ts
│       ├── config.ts
│       └── index.ts
├── package.json
├── Dockerfile
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js >= 20.9.0
- pnpm (recommended) or npm
- Docker (for containerized deployment)

### 1. Install Dependencies
```bash
# Clone the repository
git clone <your-repo-url>
cd agent-challenge

# Install dependencies
pnpm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
# LLM Configuration (Optional - defaults to local Ollama)
MODEL_NAME_AT_ENDPOINT=qwen2.5:1.5b
API_BASE_URL=http://127.0.0.1:11434/api

# Solana RPC Configuration
RPC_URL=https://api.devnet.solana.com

# For production with Nosana endpoint:
# MODEL_NAME_AT_ENDPOINT=qwen2.5:1.5b
# API_BASE_URL=https://dashboard.nosana.com/jobs/YOUR_JOB_ID
```

### 3. Build the Project
```bash
pnpm run build
```

### 4. Start Development Server
```bash
pnpm run dev
```

The agent will be available at:
- **Playground UI**: `http://localhost:8080/playground`
- **API Endpoint**: `http://localhost:8080/api/agents/solanaProgramAgent/generate`

## Environment Variables Required

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MODEL_NAME_AT_ENDPOINT` | LLM model name | `qwen2.5:1.5b` | No |
| `API_BASE_URL` | LLM API endpoint | `http://127.0.0.1:11434/api` | No |
| `RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` | No |

### Local Development with Ollama
For local development, you can use Ollama to run the LLM locally:

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# Pull the model
ollama pull qwen2.5:1.5b
```

## Docker Build and Run Commands

### Build Docker Image
```bash
# Build the image
docker build -t yourusername/solana-monitor-agent:latest .

# Tag for different versions
docker tag yourusername/solana-monitor-agent:latest yourusername/solana-monitor-agent:v1.0.0
```

### Run Docker Container
```bash
# Run locally with environment file
docker run -p 8080:8080 --env-file .env yourusername/solana-monitor-agent:latest

# Run with custom environment variables
docker run -p 8080:8080 \
  -e RPC_URL=https://api.mainnet-beta.solana.com \
  -e MODEL_NAME_AT_ENDPOINT=qwen2.5:7b \
  yourusername/solana-monitor-agent:latest

# Run in detached mode
docker run -d -p 8080:8080 --env-file .env yourusername/solana-monitor-agent:latest
```

### Push to Docker Registry
```bash
# Login to Docker Hub
docker login

# Push the image
docker push yourusername/solana-monitor-agent:latest
docker push yourusername/solana-monitor-agent:v1.0.0
```

## Example Usage

### 1. Basic Program Analysis
```bash
curl -X POST http://localhost:8080/api/agents/solanaProgramAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { 
        "role": "user", 
        "content": "Analyze this Anchor program: 9gJ7jZaAvUafgTFPoqkCwbuvC9kpZCPtHfHjMkQ66wu9" 
      }
    ],
    "resourceId": "user_123",
    "threadId": "conversation_456"
  }'
```

### 2. List All Instructions
```bash
curl -X POST http://localhost:8080/api/agents/solanaProgramAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { 
        "role": "user", 
        "content": "List all instructions for this program" 
      }
    ],
    "resourceId": "user_123",
    "threadId": "conversation_456"
  }'
```

### 3. Fetch Account Data
```bash
curl -X POST http://localhost:8080/api/agents/solanaProgramAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { 
        "role": "user", 
        "content": "List all SmartWalletConfig accounts" 
      }
    ],
    "resourceId": "user_123",
    "threadId": "conversation_456"
  }'
```

### 4. Memory-Enhanced Queries
```bash
# First request - analyze a program
curl -X POST http://localhost:8080/api/agents/solanaProgramAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { 
        "role": "user", 
        "content": "Analyze this program: 9gJ7jZaAvUafgTFPoqkCwbuvC9kpZCPtHfHjMkQ66wu9" 
      }
    ],
    "resourceId": "user_123",
    "threadId": "conversation_456"
  }'

# Second request - reference previous analysis (agent remembers the program)
curl -X POST http://localhost:8080/api/agents/solanaProgramAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { 
        "role": "user", 
        "content": "What was the name of the program I just analyzed?" 
      }
    ],
    "resourceId": "user_123",
    "threadId": "conversation_456"
  }'
```

### 5. Interactive Playground
Visit `http://localhost:8080/playground` to interact with the agent through a web interface.

## Available Tools

The agent provides 15 specialized tools for Solana program analysis:

1. **analyzeProgramTool** - Basic program overview and metadata
2. **listAllInstructionsTool** - List all program instructions with details
3. **listAllAccountsTool** - List all account structures with details
4. **listAllErrorsTool** - List all error codes with details
5. **listAllTypesTool** - List all types/structs with details
6. **getInstructionDetailsTool** - Detailed instruction analysis
7. **getAccountDetailsTool** - Account structure information
8. **getErrorDetailsTool** - Specific error details
9. **getTypeDetailsTool** - Specific type/struct details
10. **getProgramAccountsByTypeTool** - List existing accounts by type
11. **fetchAllAccountsTool** - Fetch all accounts of a type
12. **fetchAccountDataTool** - Fetch single account data
13. **fetchAccountsByFilterTool** - Filter accounts by field values
14. **searchAccountsByPubkeyTool** - Search accounts by public keys
15. **derivePdaAddressTool** - Derive PDA addresses from seeds

## Testing

### Run Memory Test
```bash
node test-memory.js
```

### Test Specific Functionality
```bash
# Test program analysis
curl -X POST http://localhost:8080/api/agents/solanaProgramAgent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { 
        "role": "user", 
        "content": "Analyze this Anchor program: 9gJ7jZaAvUafgTFPoqkCwbuvC9kpZCPtHfHjMkQ66wu9" 
      }
    ],
    "resourceId": "user_123",
    "threadId": "conversation_456"
  }'
```

## Development Commands

```bash
# Development server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start

# Lint code
pnpm run lint

# Format code
pnpm run format

# Check code quality
pnpm run check
```

The agent follows the Mastra framework patterns and provides comprehensive Solana blockchain analysis capabilities with persistent memory and context awareness.
