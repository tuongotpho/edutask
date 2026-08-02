import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(__dirname, 'test-logs.txt');
const SCREENSHOT_DIR = path.join(__dirname, 'artifacts', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}
fs.writeFileSync(LOG_FILE, '=== ROBUST E2E TEST LOGS ===\n\n');

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `[SYSTEM] ${msg}\n`);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  log('Starting Puppeteer for Robust Deep E2E Testing...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  // Auto-dismiss and log dialogs (alerts, confirms, prompts) to prevent hanging
  const pageHandler = async (page: any) => {
    page.on('dialog', async (dialog: any) => {
      log(`[Browser Dialog] ${dialog.type()}: ${dialog.message()}`);
      await dialog.accept();
    });
    page.on('console', (msg: any) => log(`[Browser Console] ${msg.type().toUpperCase()}: ${msg.text()}`));
  };

  let context = await browser.createBrowserContext();
  let page = await context.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await pageHandler(page);

  // Function to login
  async function login(email: string, pass: string) {
    log(`Logging in as ${email}...`);
    
    // Always start from a clean slate by using a fresh context
    if (context) {
      await context.close();
    }
    context = await browser.createBrowserContext();
    page = await context.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await pageHandler(page);
    
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await delay(2000);
    
    // Clear and fill email
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', email, { delay: 50 });
    
    // Clear and fill pass
    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', pass, { delay: 50 });
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `login_before_${email.replace('@', '_')}.png`) });

    // Submit by pressing Enter in the password field
    await page.keyboard.press('Enter');
    await delay(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `login_after_${email.replace('@', '_')}.png`) });

    const errMsg = await page.evaluate(() => {
      const el = document.querySelector('.text-rose-400');
      return el ? el.textContent : null;
    });
    if (errMsg) throw new Error(`Login error: ${errMsg}`);
    
    log(`Logged in as ${email}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `login_after_${email.replace('@', '_')}.png`) });
  }

  async function logout() {
    log('Logging out...');
    try {
      // Find the user dropdown button (it's the only one with w-7 h-7 rounded-full)
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerHTML.includes('w-7 h-7 rounded-full'));
        if (btn) btn.click();
      });
      await delay(500);
      
      // Click logout
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const logoutBtn = btns.find(b => b.textContent?.includes('Đăng Xuất Tài Khoản'));
        if (logoutBtn) logoutBtn.click();
      });
      
      await delay(1000);
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await delay(1000);
    } catch(e) {}
    log('Logged out.');
  }

  // Define a robust clicker by text
  async function clickByText(text: string) {
    log(`Looking for text: "${text}"`);
    for (let i = 0; i < 5; i++) {
      const handle = await page.evaluateHandle((txt) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeValue && node.nodeValue.includes(txt) && node.parentElement) {
            const el = node.parentElement;
            return el.closest('button') || el.closest('[role="button"]') || el.closest('.cursor-pointer') || el.closest('a') || el;
          }
        }
        return null;
      }, text);
      
      if (handle.asElement()) {
        await page.evaluate((el: Element | null) => {
          if (el && 'click' in el) (el as HTMLElement).click();
        }, handle);
        log(`Clicked element containing: "${text}"`);
        return true;
      }
      await delay(1000);
    }
    const html = await page.evaluate(() => document.body.innerText);
    log(`Failed to find element containing: "${text}". Body text preview: ${html.substring(0, 500).replace(/\n/g, ' ')}`);
    return false;
  }

  try {
    // 1. HOA1
    await login('hoa1@gmail.com', '123456');
    log('Clicking Nghỉ Phép tab...');
    await clickByText('Nghỉ Phép');
    await delay(2000);
    
    log('Clicking Tạo Đơn...');
    await clickByText('Tạo Đơn Xin Nghỉ');
    await page.waitForSelector('textarea', { timeout: 10000 });
    
    log('Filling reason...');
    await page.type('textarea', 'Đi khám sức khỏe định kỳ theo lịch tại bệnh viện. Đã bàn giao bài tập.');
    await delay(1000);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'hoa1_leave_filled.png') });
    log('Submitting leave request...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) (btn as HTMLButtonElement).click();
    });
    await delay(2000);
    await logout();

    // 2. NHOM TRUONG HOA
    await login('nhomtruong.hoa@gmail.com', '123456');
    
    // DUYET DON
    log('Clicking Nghỉ Phép tab...');
    await clickByText('Nghỉ Phép');
    await delay(1000);

    // Switch Role to GROUP_LEADER
    log('Switching Role to GROUP_LEADER...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Đổi vai trò thao tác hiện tại"]') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await delay(500);
    
    await clickByText('Nhóm trưởng chuyên môn');
    await delay(1000);

    // Finding the leave request
    log('Finding Leave request to approve...');
    await clickByText('khám sức khỏe định kỳ');
    await delay(1000);
    
    log('Selecting substitute teacher...');
    const selectElement = await page.$('select');
    if (selectElement) {
      await page.evaluate(() => {
        const sel = document.querySelector('select');
        if (sel && sel.options.length > 1) {
          sel.value = sel.options[sel.options.length - 1].value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await delay(1000);
      await clickByText('Lưu Điều Chỉnh Dạy Thay');
      await delay(1000);
    }
    
    log('Approving leave...');
    // Write comment
    const commentBox = await page.$('textarea');
    if (commentBox) {
      await page.type('textarea', 'Đồng ý cho nghỉ. Đã phân công giáo viên dạy thay đầy đủ.');
    }
    await clickByText('Phê Duyệt');
    await delay(2000);
    
    // GIAO VIEC
    log('Clicking Giao Việc tab...');
    await clickByText('Giao Việc');
    await delay(2000);
    
    log('Clicking Giao Việc Mới...');
    await clickByText('Giao Việc Mới');
    await page.waitForSelector('textarea', { timeout: 10000 });
    
    log('Filling task form...');
    await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      if (ta) {
        ta.value = 'Soạn đề thi học kỳ môn Hóa 10';
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        nativeInputValueSetter?.call(ta, ta.value);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await delay(500);
    
    // Select user
      await clickByText('Cá nhân'); // Assignee Type
      await delay(500);
      
      log('Selecting user GV Hoá 2...');
      await page.evaluate(() => {
        const els = document.querySelectorAll('.cursor-pointer');
        for (const el of Array.from(els)) {
          if (el.textContent && el.textContent.includes('GV Hoá 2')) {
            (el as HTMLElement).click();
          }
        }
      });
      await delay(500);
      
      // Fill Title and Deadline
      log('Filling Title and Deadline...');
      await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          if (label.textContent?.includes('iêu đề công việc')) {
            const input = label.nextElementSibling as HTMLInputElement;
            if (input && input.tagName === 'INPUT') {
               const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
               nativeSet?.call(input, 'Soạn đề cương ôn tập Hóa 10');
               input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
          if (label.textContent?.includes('ạn hoàn thành')) {
            const input = label.nextElementSibling as HTMLInputElement;
            if (input && input.tagName === 'INPUT') {
               const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
               nativeSet?.call(input, '2026-12-20 17:00');
               input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
      });
      await delay(500);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'nhomtruong_task_filled.png') });
    log('Submitting task...');
    await clickByText('Phát Hành Công Việc');
    await delay(2000);
    await logout();

    // 3. HIEU TRUONG
    await login('hieutruong@gmail.com', '123456');
    
    log('Checking Tasks...');
    await clickByText('Giao Việc');
    await delay(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'hieutruong_task_check.png') });
    
    log('Checking Leaves...');
    await clickByText('Nghỉ Phép');
    await delay(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'hieutruong_leave_check.png') });
    
    await logout();

  } catch (err) {
    log(`[ERROR] Test failed: ${err}`);
  } finally {
    log('Closing browser...');
    await browser.close();
    log('Tests completed.');
  }
}

runTests();
