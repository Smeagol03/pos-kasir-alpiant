**System Prompt / Project Context:**
You are an expert AI Software Engineer. Your task is to help develop features for a desktop Point of Sale (POS) application named `pos-kasir-alpiant`.

* **Tech Stack:** Tauri (Rust for Backend), React + Vite + Tailwind CSS (for Frontend).
* **Target OS:** Cross-platform (Primary focus: Linux/Zorin OS and Windows).
* **Core Task:** Implement dynamic settings, secure Payment Gateway integration, and a cross-OS receipt printing module (currently using an Epson L3110 inkjet to simulate a thermal printer). **Strictly ignore CI/CD, GitHub Actions, or deployment tasks.**

---

### 1. PRD: Dynamic Configuration Settings

**Objective:** Eliminate hardcoded API credentials and hardware configurations so users can manage them directly via the app's UI.

**Technical Requirements:**

* **Backend (Rust):** Implement `save_settings` and `load_settings` commands using `serde_json`. The configuration file (`settings.json`) must be securely stored in the OS's standard config directory (utilize Tauri's `app_config_dir`).
* **Frontend (React/Tailwind):** Build a Settings page/modal containing a form for:
* Payment Gateway selection (Dropdown: Midtrans, Xendit, etc.).
* Server Key / API Key (Password input).
* Environment mode (Toggle: Sandbox / Production).
* Printer selection (Dropdown: List of installed OS printers).


* **Security constraint:** Configurations must be loaded into the app's state on startup. The API Key must strictly remain on the Rust backend and never be exposed to the React frontend during transactions.

---

### 2. PRD: Secure Payment Gateway Integration

**Objective:** Process QR code or Virtual Account payments securely via server-to-server communication to protect API keys.

**Technical Requirements:**

* **Backend (Rust):** Create a `create_transaction(amount, order_id)` command. This function must:
1. Read the Server Key from the saved `settings.json`.
2. Execute an HTTP POST request (using the `reqwest` crate) to the Payment Gateway API.
3. Return the payload (checkout URL or QR string) to the frontend.


* **Frontend (React):** Call `create_transaction` via Tauri's `invoke`. Handle the loading state and render the payment UI (e.g., displaying the QR Code or a payment link).

---

### 3. PRD: Cross-Platform Printer Module (Thermal Simulator)

**Objective:** Ensure stable receipt printing on both Linux and Windows. Since the app uses an Epson L3110 inkjet to simulate a thermal printer, we must avoid standard A4 document printing behaviors that ruin the receipt layout.

**Technical Requirements:**

* **"HTML-to-Image" Approach:** * **Frontend (React):** Design a hidden `ReceiptUI` component with a fixed width (e.g., `w-[58mm]`), monospace font, and Tailwind styling that mimics a real thermal receipt (dashed lines, header, itemized list, total).
* Use a library (e.g., `html-to-image`) to capture this DOM element and convert it into a Base64 PNG string.


* **Backend (Rust):** Create a `print_receipt(base64_image)` command. This function must:
1. Read the target printer name from `settings.json`.
2. Decode the Base64 string and save it as a temporary image file.
3. **On Linux:** Execute the system command `lp -d <printer_name> <temp_image_file>`.
4. **On Windows:** Use a native Windows print command or a dedicated crate to send the image directly to the Epson L3110 spooler silently, completely bypassing the Windows print dialog.



---

### System Architecture Flow

**Flow 1: Application Initialization**

1. The Tauri application launches.
2. React mounts the main component and calls `invoke('load_settings')`.
3. Rust reads `settings.json` from the OS config directory and returns the parsed data.
4. React stores the configuration (printer name, gateway preference) in its Global State (Zustand/Context).

**Flow 2: Payment Transaction Execution**

1. The cashier clicks the "Pay" button.
2. React triggers `invoke('create_transaction', { amount, order_id })`.
3. Rust retrieves the API Key from its local settings and calls the external Payment Gateway API.
4. Rust sends the transaction token/URL back to React.
5. React displays the QRIS code and polls/waits for confirmation.

**Flow 3: Receipt Printing Process (Thermal Simulation)**

1. Transaction succeeds. React renders the transaction data into the `ReceiptUI` (58mm width) component.
2. React converts the UI element into a Base64 Image string.
3. React calls `invoke('print_receipt', { image_data: base64_string })`.
4. Rust receives the payload and creates a `.png` temporary file.
5. Rust detects the target OS:
* *If Linux:* Dispatches the `lp` command to the CUPS server using the saved printer name.
* *If Windows:* Dispatches the image to the Winspool service targeting the L3110.


6. Rust cleans up (deletes) the temporary file and returns a success status to React.
