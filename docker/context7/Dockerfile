FROM node:20-slim

# Install the Context7 MCP server
RUN npm install -g @upstash/context7-mcp@latest

# Expose the port
EXPOSE 3003

# Run the MCP server
CMD ["npx", "@upstash/context7-mcp@latest"]