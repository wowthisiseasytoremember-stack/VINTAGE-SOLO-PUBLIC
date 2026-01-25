const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    // 1. Launch Browser
    // Attempt to find local Chrome since npm install failed
    const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH 
    ].filter(Boolean);

    let executablePath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            executablePath = p;
            break;
        }
    }

    if (!executablePath) {
        console.error("❌ Could not find Chrome! Please set CHROME_PATH env var or install Chrome.");
        // Fallback to Puppeteer's default logic (which might fail if download failed)
    } else {
        console.log(`✅ Found Chrome at: ${executablePath}`);
    }

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: executablePath || undefined,
        defaultViewport: null,
        args: ['--start-maximized', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    
    // Helper to capture screenshot with timestamp
    const capture = async (name) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${name}_${timestamp}.png`;
        const dir = 'C:\\Users\\wowth\\.gemini\\antigravity\\brain\\544c7c49-6a34-4042-9c49-ad27c8e6a13e'; // artifacts dir
        const filepath = path.join(dir, filename);
        await page.screenshot({ path: filepath });
        console.log(`📸 Screenshot saved: ${filename}`);
    };

    console.log("🌐 Navigating to App...");
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // 2. Wait for Initial Load
    await capture('01_initial_load');

    // 3. Check if logged in, if not, wait for user
    console.log("⏳ Checking login status...");
    // We look for the "Sign in with Google" button or the User Profile
    try {
        const loginBtn = await page.$('button[class*="btn-primary"]'); 
        if (loginBtn) {
            const text = await page.evaluate(el => el.textContent, loginBtn);
            if (text.includes("Sign in")) {
                console.log("⚠️  LOGIN REQUIRED!");
                console.log("👉 Please click 'Sign in with Google' in the browser window and complete login.");
                console.log("⏳ Script is waiting for 'Sign Out' button to appear...");
                
                // Wait indefinitely (or long timeout) for user to log in
                // We'll poll for the presence of the User Avatar/Text or Sign Out button
                await page.waitForFunction(
                    () => document.body.innerText.includes('Sign Out') || document.body.innerText.includes('User'),
                    { timeout: 300000 } // 5 minutes to log in
                );
                console.log("✅ Login detected!");
                // Wait a moment for UI to settle
                await new Promise(r => setTimeout(r, 2000));
                await capture('02_logged_in');
            }
        }
    } catch (e) {
        console.log("ℹ️  Already logged in or login skipped.");
    }

    // 4. Start New Session Flow
    console.log("🚀 Starting Session Flow...");
    
    const boxInput = await page.$('input[placeholder*="Atttc Box"]');
    if (boxInput) {
        await boxInput.type('E2E-TEST-BOX-01');
        await new Promise(r => setTimeout(r, 500));
        await capture('03_entered_box_id');
    }

    // 5. Simulate File Upload (Dropzone)
    // We need a test image. We'll generate a dummy one if it doesn't exist.
    const testImagePath = path.join(__dirname, 'test_pixel.jpg');
    if (!fs.existsSync(testImagePath)) {
        // Create a tiny valid JPG (1x1 white pixel)
        const buffer = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==', 'base64');
        fs.writeFileSync(testImagePath, buffer);
    }

    console.log("📤 Uploading Test Image...");
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(testImagePath);
    await new Promise(r => setTimeout(r, 1000));
    await capture('04_image_uploaded');

    // 6. Click Start AI
    console.log("🤖 Starting AI Analysis...");
    try {
        await page.waitForSelector('button.btn-primary:not([disabled])', { timeout: 5000 });
        const buttons = await page.$$('button.btn-primary');
        let clicked = false;
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text.includes('Step 3') || text.includes('RUN AI') || text.includes('Identify')) {
                console.log(`Found button: ${text}`);
                await btn.click();
                clicked = true;
                break;
            }
        }
        if (!clicked) {
             console.error("❌ Link/Button not found! dumping HTML...");
             const html = await page.content();
             console.log(html.slice(0, 1000)); 
             throw new Error("Start Button not found");
        }
    } catch (e) {
        console.error("Failed to click start:", e);
        throw e;
    }
    
    // Wait for processing to finish (look for "Processing Queue" or "Inventory")
    console.log("⏳ Waiting for AI...");
        await page.waitForFunction(
            () => document.body.innerText.includes('Finished') || document.body.innerText.includes('Processed (1)'),
            { timeout: 60000 }
        );
        await new Promise(r => setTimeout(r, 1000));
        await capture('05_analysis_complete_queue');


    // 7. Wait for Processing (AI or Fallback)
    console.log("⏳ Waiting for AI (or Local Fallback)...");
    try {
        await page.waitForFunction(
            () => {
                const text = document.body.innerText;
                // Success | Fallback Title | Processed Count
                return text.includes('Finished') || text.includes('Processed (1)') || text.includes('Unidentified Item');
            },
            { timeout: 60000 } 
        );
        console.log("✅ Analysis/Fallback Complete!");
        await new Promise(r => setTimeout(r, 1000));
        await capture('05_after_analysis');
    } catch(e) {
        console.warn("⚠️ AI Wait Timed Out - continuing to UX Audit anyway...");
        await capture('05_timeout_debug');
    }

    // 8. Go to Dashboard to verify result
    console.log("👀 verifying results on Dashboard...");
    const backBtn = await page.$x("//button[contains(., 'Back to Dashboard')]");
    if (backBtn.length > 0) {
        await backBtn[0].click();
        await new Promise(r => setTimeout(r, 1500));
    }
    await capture('06_dashboard_with_result');

    // 9. Test Export CSV
    console.log("📥 Testing CSV Export...");
    const exportBtn = await page.$x("//button[contains(., 'Export CSV')]");
    if (exportBtn.length > 0) {
        await exportBtn[0].click();
        await new Promise(r => setTimeout(r, 2000)); 
        await capture('07_export_clicked');
    }

    // 10. UX Audit: Capture All Screens / Navigation Flow
    console.log("🎨 Capturing Screens for UX Review...");

    // A. Settings Screen
    console.log("   -> Navigating to Settings");
    const settingsBtn = await page.$('button[aria-label="Settings"], button.btn-ghost'); 
    // Trying a few selectors for settings icon/button
    // If we can't find it easily, we'll try evaluating the menu
    if (settingsBtn) {
        await settingsBtn.click();
    } else {
        // Fallback: try text search
        const sBtn = await page.$x("//button[contains(., 'Settings') or contains(., 'Config')]");
        if (sBtn.length > 0) await sBtn[0].click();
    }
    await new Promise(r => setTimeout(r, 1000));
    await capture('UX_Settings');

    // B. Return Home
    console.log("   -> Returning Home");
    // Look for "Home" or "Close" or just refresh
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));

    // C. Inventory/History Screen
    console.log("   -> Navigating to Inventory");
     const inventoryBtn = await page.$x("//button[contains(., 'Inventory')]");
    if (inventoryBtn.length > 0) {
        await inventoryBtn[0].click();
        await new Promise(r => setTimeout(r, 1000));
        await capture('UX_Inventory');
    }

    // D. Back to Home again to ensure loop works
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    
    // E. Capture Batch History at bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1000));
    await capture('UX_Home_Bottom_History');


    console.log("🎉 E2E UX Audit Completed!");
    
    // ... rest of script ...
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();

})().catch(err => {
    console.error("❌ FATAL ERROR IN SCRIPT:");
    console.error(err);
    process.exit(1);
});
