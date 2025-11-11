#!/bin/bash

echo ""
echo "================================"
echo "   Starting Aiba PM"
echo "================================"
echo ""

# Kill any existing processes on ports
echo "Cleaning up ports..."
node kill-ports.js

echo ""
echo "Starting backend and frontend servers..."
echo ""

# Start both servers using concurrently
npm run dev

echo ""
echo "Note: Press Ctrl+C to stop all servers"
echo ""
