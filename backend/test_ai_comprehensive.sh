#!/bin/bash

# Comprehensive test script for AI service features
# Make sure backend is running: cd backend && python -m uvicorn app.main:app --reload

set -e

BASE_URL="http://localhost:8000"
DATASET_ID="discussion_demo"

echo "============================================"
echo "AI Service Feature Test Suite"
echo "============================================"
echo ""

# Test 1: Health Check
echo "TEST 1: Health Check"
echo "GET /"
curl -s "$BASE_URL/" | jq .
echo ""
echo ""

# Test 2: List Datasets
echo "TEST 2: List Available Datasets"
echo "GET /datasets"
DATASETS=$(curl -s "$BASE_URL/datasets")
echo "$DATASETS" | jq .
echo ""
echo ""

# Test 3: Original Messages Endpoint (without annotations)
echo "TEST 3: Original Messages (no AI annotations)"
echo "GET /discussions/$DATASET_ID/messages"
ORIGINAL=$(curl -s "$BASE_URL/discussions/$DATASET_ID/messages")
echo "$ORIGINAL" | jq '.messages[0]'
echo ""
echo ""

# Test 4: NEW - Annotated Messages with AI
echo "TEST 4: NEW - Annotated Messages with AI Labels"
echo "GET /discussions/$DATASET_ID/messages/annotated"
ANNOTATED=$(curl -s "$BASE_URL/discussions/$DATASET_ID/messages/annotated")
echo "$ANNOTATED" | jq '.messages[0:3]'
echo ""
echo "Summary:"
echo "$ANNOTATED" | jq '{messageCount: .messageCount, warnings: .warnings}'
echo ""
echo ""

# Test 5: Original Thread Endpoint (no summaries)
echo "TEST 5: Original Thread Structure (no summaries)"
echo "GET /discussions/$DATASET_ID/thread"
THREAD=$(curl -s "$BASE_URL/discussions/$DATASET_ID/thread")
echo "$THREAD" | jq '.stats'
echo ""
echo ""

# Test 6: NEW - AI Summary Endpoint
echo "TEST 6: NEW - AI Summaries for Each Root Thread"
echo "GET /discussions/$DATASET_ID/ai-summary"
SUMMARY=$(curl -s "$BASE_URL/discussions/$DATASET_ID/ai-summary")
echo "$SUMMARY" | jq '.summaries'
echo ""
echo ""

# Test 7: Validate Annotation Labels
echo "TEST 7: Validate Annotation Labels"
echo "Checking that all messages have topic and sentiment..."
MISSING=$(echo "$ANNOTATED" | jq '.messages[] | select(.topic == "unknown" or .sentiment == "unknown") | .id' | wc -l)
TOTAL=$(echo "$ANNOTATED" | jq '.messageCount')
echo "Messages with missing labels: $MISSING / $TOTAL"
if [ "$MISSING" -eq 0 ]; then
  echo "✅ All messages are fully annotated!"
else
  echo "⚠️  Some messages have 'unknown' labels (API likely not working)"
fi
echo ""
echo ""

# Test 8: Validate Summary Structure
echo "TEST 8: Validate Summary Structure"
echo "Checking that summaries have required fields..."
SUMMARY_COUNT=$(echo "$SUMMARY" | jq '.summaryCount')
echo "Root threads found: $SUMMARY_COUNT"
echo "$SUMMARY" | jq '.summaries[0] | keys'
echo ""
echo ""

echo "============================================"
echo "Test Suite Complete!"
echo "============================================"
echo ""
echo "Key Observations:"
echo "- If topic/sentiment are NOT 'unknown': OpenAI API is working! 🎉"
echo "- If topic/sentiment are 'unknown': API key may not be loaded properly"
echo "- If summaries don't have '[No API]' prefix: Summarization API is working! 🎉"
