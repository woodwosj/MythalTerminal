FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    context-portal-mcp \
    fastapi \
    uvicorn \
    sqlalchemy \
    alembic

# Expose the port
EXPOSE 3002

# Run the MCP server
CMD ["python", "-m", "context_portal_mcp"]