#!/bin/bash

# Test script for AI annotation and summary endpoints
# Run this after starting the backend with: python -m uvicorn app.main:app --reload

set -e

BASE_URL="http://localhost:8000"
DATASET_ID="discussion_demo"

echo "======================================"
echo "Testing Discussion Thread AI Endpoints"
echo "======================================"
echo ""

echo "1. Testing GET /datasets"
curl -s "$BASE_URL/datasets" | jq .
echo ""
echo ""

echo "2. Testing GET /discussions/$DATASET_ID/messages/annotated"
echo "   (Testing message enrichment with topic and sentiment)"
curl -s "$BASE_URL/discussions/$DATASET_ID/messages/annotated" | jq .
echo ""
echo ""

echo "3. Testing GET /discussions/$DATASET_ID/ai-summary"
echo "   (Testing AI-generated summaries for root threads)"
curl -s "$BASE_URL/discussions/$DATASET_ID/ai-summary" | jq .
echo ""
echo ""

echo "======================================"
echo "Test Complete"
echo "======================================"
echo ""
echo "Expected behavior:"
echo "- If OPENAI_API_KEY is set: annotations and summaries are generated via API"
echo "- If OPENAI_API_KEY is missing: fallback heuristics are used"
echo "- Both endpoints should return proper structure regardless"
echo ""
