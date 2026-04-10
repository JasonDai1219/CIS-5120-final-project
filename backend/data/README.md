# Available Discussion Datasets

This directory contains sample discussion thread datasets for the Discussion Thread Visualization project.

## Datasets

### 1. `discussion_demo.json`
- **Topic**: Deadline Extension & Grading Policy
- **Messages**: 8
- **Threads**: 2
- **Description**: Original demo dataset with discussion about assignment deadline extension and grading rubrics.

### 2. `course_content.json`
- **Topic**: Course Content & Curriculum
- **Messages**: 9
- **Threads**: 2
- **Description**: Discussion about lecture topics, including machine learning, data visualization, and exam practice problems.

### 3. `course_difficulty.json`
- **Topic**: Course Difficulty & Support
- **Messages**: 9
- **Threads**: 2
- **Description**: Student feedback on course difficulty level, resource availability, and office hours support.

### 4. `resources.json`
- **Topic**: Learning Resources & Tools
- **Messages**: 9
- **Threads**: 2
- **Description**: Recommendations and discussions about learning resources (tutorials, textbooks), and data processing libraries (Pandas, scikit-learn, Polars).

### 5. `project_qa.json`
- **Topic**: Final Project Questions & Answers
- **Messages**: 9
- **Threads**: 1
- **Description**: Q&A about final project requirements, submission format, deadlines, and library usage.

## Format

Each dataset is a JSON array of message objects with the following structure:

```json
{
  "id": "unique_message_id",
  "author": "Author Name",
  "timestamp": "2026-03-01T09:00:00Z",
  "text": "Message content",
  "parentId": null  // or ID of parent message
}
```

- `parentId: null` indicates a root/top-level message
- Messages can reference non-existent parents (handled as orphans)
- Timestamps follow ISO 8601 format

## Adding New Datasets

To add a new dataset:
1. Create a new JSON file in this directory (e.g., `new_dataset.json`)
2. Follow the message format above
3. The backend will automatically detect it and make it available via `/datasets` endpoint

## AI Features

Each dataset supports:
- **Message Annotation**: `/discussions/{dataset_id}/messages/annotated` - Adds AI-generated topic and sentiment
- **Thread Summarization**: `/discussions/{dataset_id}/ai-summary` - Generates summaries and key points for each discussion thread
