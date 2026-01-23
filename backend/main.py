
@app.post("/api/create-batch", response_model=BatchResponse)
async def create_batch(
    box_id: str = Form(...),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Create a new empty batch for camera session"""
    batch_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat() + "Z"
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO batches (batch_id, box_id, total_images, processed, failed, created_at, updated_at, status, current_image_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (batch_id, box_id, 0, 0, 0, created_at, created_at, 'pending', 0))
        conn.commit()
    finally:
        conn.close()
        
    return BatchResponse(
        batch_id=batch_id,
        box_id=box_id,
        total_images=0,
        processed=0,
        failed=0,
        items=[],
        created_at=created_at,
        status="pending",
        current_image_index=0
    )

async def process_item_background(batch_id: str, box_id: str, item_id: int, file_paths: List[Path]):
    """Background task to process a single item (one or more images)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    import traceback
    
    try:
        # Update batch status to processing
        cursor.execute("""
            UPDATE batches SET status = 'processing', updated_at = ? WHERE batch_id = ?
        """, (datetime.now(timezone.utc).isoformat() + "Z", batch_id))
        
        # Update item status to processing
        cursor.execute("""
            UPDATE batch_items SET status = 'processing' WHERE id = ?
        """, (item_id,))
        conn.commit()
        
        # Process with AI
        ai_result = await process_image_with_ai(file_paths, box_id)
        
        processed_at = datetime.now(timezone.utc).isoformat() + "Z"
        
        # Update item
        cursor.execute("""
            UPDATE batch_items 
            SET title = ?, type = ?, year = ?, notes = ?, 
                confidence = ?, processed_at = ?, status = 'completed', error_message = NULL
            WHERE id = ?
        """, (
            ai_result["title"], ai_result["type"],
            ai_result.get("year") or "", ai_result.get("notes") or "", 
            ai_result["confidence"], processed_at, item_id
        ))
        
        # Update batch counts
        cursor.execute("SELECT COUNT(*) FROM batch_items WHERE batch_id = ? AND status = 'completed'", (batch_id,))
        processed = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM batch_items WHERE batch_id = ? AND status = 'failed'", (batch_id,))
        failed = cursor.fetchone()[0]
        
        cursor.execute("""
            UPDATE batches 
            SET processed = ?, failed = ?, updated_at = ?
            WHERE batch_id = ?
        """, (processed, failed, datetime.now(timezone.utc).isoformat() + "Z", batch_id))
        conn.commit()
        
    except Exception as e:
        print(f"Error processing item {item_id}: {e}")
        traceback.print_exc()
        cursor.execute("""
            UPDATE batch_items SET status = 'failed', error_message = ? WHERE id = ?
        """, (str(e), item_id))
        conn.commit()
    finally:
        conn.close()

@app.post("/api/process-item")
async def process_item(
    background_tasks: BackgroundTasks,
    batch_id: str = Form(...),
    box_id: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Upload images for a single item and process immediately"""
    
    saved_paths = []
    # Save files
    for idx, file in enumerate(files):
        safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._- ")[:200]
        saved_path = STORAGE_PATH / f"{batch_id}_{uuid.uuid4()}_{safe_filename}"
        content = await file.read()
        with open(saved_path, "wb") as f:
            f.write(content)
        saved_path = convert_heic_to_jpg(saved_path)
        saved_paths.append(saved_path)
    
    # Create DB entry
    created_at = datetime.now(timezone.utc).isoformat() + "Z"
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Determine primary filename (use first one)
    primary_filename = files[0].filename
    primary_path = str(saved_paths[0])
    
    try:
        cursor.execute("""
            INSERT INTO batch_items 
            (batch_id, filename, box_id, title, type, year, notes, confidence, processed_at, image_path, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        """, (
            batch_id, primary_filename, box_id, "", "other", "", "", "pending", 
            created_at, primary_path
        ))
        item_id = cursor.lastrowid
        
        # Update batch total count
        cursor.execute("""
            UPDATE batches SET total_images = total_images + 1, updated_at = ? WHERE batch_id = ?
        """, (created_at, batch_id))
        conn.commit()
        
        background_tasks.add_task(process_item_background, batch_id, box_id, item_id, saved_paths)
        
        return {"status": "queued", "item_id": item_id}
        
    finally:
        conn.close()
