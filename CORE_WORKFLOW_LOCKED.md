# Core Workflow - LOCKED DOWN ✅

## Status: Production Ready

The core workflow has been hardened and is ready for reliable use.

## Core Workflow (MVP)

**The single critical workflow that MUST work perfectly:**

1. ✅ User enters box identifier (e.g., "BOX34")
2. ✅ User uploads batch of images (100-200 images supported)
3. ✅ System processes each image with GPT-4o mini
4. ✅ System extracts metadata (title, type, year, notes, confidence)
5. ✅ User downloads CSV with all items tagged with box ID

## Hardening Improvements Added

### Backend Robustness

1. **File Size Validation**
   - Maximum 50MB per file (configurable via `MAX_FILE_SIZE_MB`)
   - Empty file detection
   - Prevents server overload

2. **Box ID Validation & Sanitization**
   - Maximum 100 characters
   - Removes problematic characters (commas, newlines) for CSV safety
   - Prevents CSV corruption

3. **Filename Sanitization**
   - Removes unsafe filesystem characters
   - Prevents path traversal attacks
   - Limits filename length

4. **OpenAI API Retry Logic**
   - 3 retry attempts with exponential backoff (2s, 4s, 6s)
   - Handles transient API failures gracefully
   - Continues processing other images if one fails

5. **Error Handling**
   - Individual image failures don't crash the batch
   - Detailed error logging for debugging
   - Graceful degradation

6. **CSV Generation**
   - Proper UTF-8 encoding with BOM for Excel compatibility
   - Escapes special characters (commas, quotes, newlines)
   - Handles None/null values safely
   - Safe filename generation

### Frontend Robustness

1. **Request Timeout**
   - 30-minute timeout for large batches
   - Clear error messages for timeout scenarios

2. **Error Handling**
   - Specific error messages for different failure types:
     - Timeout errors
     - File size errors (413)
     - Server errors (500+)
     - Validation errors (400)
   - User-friendly error messages

3. **CSV Download**
   - Proper CSV escaping
   - UTF-8 BOM for Excel compatibility
   - Safe filename generation
   - Error handling if download fails

4. **Progress Tracking**
   - Upload progress indicator
   - Clear status messages during processing
   - Visual feedback throughout

## Validation Rules

### Box ID
- Required
- Max 100 characters
- Automatically sanitized (commas/newlines removed)

### Files
- Supported formats: JPG, JPEG, PNG, HEIC, HEIF
- Max 200 files per batch
- Max 50MB per file
- Empty files rejected

### Processing
- Continues on individual failures
- Retries API calls up to 3 times
- Logs all errors for debugging

## Error Recovery

- **Individual image failure**: Continues with remaining images
- **API timeout**: Retries with exponential backoff
- **File too large**: Skips file, continues with others
- **Invalid file type**: Skips file, continues with others
- **CSV generation failure**: Returns error, doesn't crash

## Logging

Backend provides detailed logging:
- Batch start/end with summary
- Per-image processing status
- API call results
- Error details with stack traces

## Success Criteria (All Met ✅)

1. ✅ User can upload 100 images in one batch
2. ✅ User can enter a box ID that tags the entire batch
3. ✅ AI identifies at least basic title/type for images
4. ✅ CSV downloads with all processed items
5. ✅ CSV includes box ID in every row
6. ✅ Process completes without crashing
7. ✅ System handles errors gracefully

## Configuration

Environment variables:
- `OPENAI_API_KEY` - Required
- `MAX_IMAGES_PER_BATCH` - Default: 200
- `MAX_FILE_SIZE_MB` - Default: 50
- `STORAGE_PATH` - Default: `backend/storage`
- `EXPORTS_PATH` - Default: `backend/exports`

## Next Steps: QoL Improvements

Now that the core workflow is locked down, we can add:

1. **Batch History** - View and re-download previous batches
2. **Manual Editing** - Edit metadata after processing
3. **Image Preview** - Show thumbnails in review table
4. **Bulk Operations** - Select and edit multiple items
5. **Export Formats** - JSON, Excel, etc.
6. **Search/Filter** - Find items in large batches
7. **Cost Tracking** - Track API usage per batch
8. **Reprocessing** - Re-run failed or low-confidence items

But first: **The core workflow is bulletproof. Ship it!** 🚀
