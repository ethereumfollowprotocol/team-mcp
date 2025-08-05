import { z } from 'zod';

export interface FinancialReport {
  quarter: string;
  year: number;
  imageUrls: string[];
  extractedData?: ExtractedFinancialData;
}

export interface ExtractedFinancialData {
  revenue?: number;
  expenses?: number;
  netIncome?: number;
  grossProfit?: number;
  operatingIncome?: number;
  assets?: number;
  liabilities?: number;
  equity?: number;
  cashFlow?: number;
  customMetrics?: Record<string, any>;
  rawText: string;
}

export class FinancialReportsService {
  private reports: Map<string, FinancialReport> = new Map();

  constructor(private env: Env) {
    // Initialize with your financial reports
    this.initializeReports();
  }

  private initializeReports() {
    // Define your financial reports here with pre-cached data for common queries
    const reportsData: FinancialReport[] = [
      {
        quarter: 'Q2',
        year: 2024,
        imageUrls: ['https://discuss.ens.domains/uploads/db9688/original/2X/5/5bdec62cae38cdfe36e9d3f55bee6fb9c8a01514.jpeg'],
        // Pre-cached data for Q2 2024 based on actual financial reports
        extractedData: {
          revenue: 124672.65,
          expenses: 62717.75,
          netIncome: 61954.9,
          assets: 146006.91,
          liabilities: 10245.94,
          equity: 135760.97,
          customMetrics: {
            eth_holdings: 88.92,
            income_ens_dao_streams: 81088.32,
            income_realized_gain_loss: 15.12,
            expense_salaries: 59803.32,
            expense_ens_registration: 674.53,
            expense_eth_gas: 39.66,
            expense_legal_services: 5441.0,
            expense_software: 2874.77,
            unreimbursed_admin_costs: 10245.94,
          },
          rawText: 'Pre-cached financial data for Q2 2024 - Based on actual OCR extraction',
        },
      },
      {
        quarter: 'Q3',
        year: 2024,
        imageUrls: [
          'https://discuss.ens.domains/uploads/db9688/original/2X/5/5d0ebd43d1552fb872d92ce4d675930c484608f5.jpeg',
          'https://discuss.ens.domains/uploads/db9688/original/2X/0/0439583f5c1b4ca4c304be8b0e561c20c8d839c5.jpeg',
        ],
        // Pre-cached data for Q3 2024 based on actual financial reports
        extractedData: {
          revenue: 177419.51,
          expenses: 113805.16,
          netIncome: 63614.35,
          assets: 220318.72,
          liabilities: 2305.69,
          equity: 220318.72,
          customMetrics: {
            eth_holdings: 64.16186,
            eth_price: 2662.49,
            eth_value: 170830.32,
            usdcx_holdings: 37597.38,
            usdc_holdings: 14196.71,
            unreimbursed_admin_costs: 2305.69,
            income_ens_dao_stream: 127397.26,
            income_mask_grant: 50000.0,
            income_realized_gain_loss: 22.33,
            expense_team: 71562.5,
            expense_legal_services: 13566.34,
            expense_bounties: 18650.89,
            expense_services: 1064.48,
            expense_conferences_travel: 4910.7,
            expense_other: 2160.22,
            expense_poap: 1175.0,
            expense_accounting: 465.0,
            expense_eth_gas: 250.03,
          },
          rawText: 'Pre-cached financial data for Q3 2024 - Based on actual OCR extraction',
        },
      },
      {
        quarter: 'Q4',
        year: 2024,
        imageUrls: [
          'https://discuss.ens.domains/uploads/db9688/original/2X/7/7a80fa4dbe56021c02e2b28a57a7a5e1d3f04fc6.png',
          'https://discuss.ens.domains/uploads/db9688/original/2X/2/2065db635fef13ba9c9314806d14c4248f2cec62.png',
        ],
        // Pre-cached data for Q4 2024 based on actual financial reports
        extractedData: {
          revenue: 164070.13,
          expenses: 125189.3,
          netIncome: 38880.83,
          assets: 406374.77,
          liabilities: 4808.34,
          equity: 406374.77,
          customMetrics: {
            eth_holdings: 61.763,
            eth_price: 3332.53,
            eth_value: 205841.51,
            ens_holdings: 4290.029,
            ens_price: 33.67,
            ens_value: 144445.31,
            usdcx_holdings: 40032.58,
            usdc_holdings: 20863.71,
            unreimbursed_admin_costs: 4808.34,
            income_ens_dao_stream: 126027.41,
            income_ens_dao_vesting: 37854.17,
            expense_team: 96803.15,
            expense_services: 8672.58,
            expense_poap: 6750.0,
            expense_other: 5659.1,
            expense_legal_services: 2725.72,
            expense_bounties: 2124.4,
          },
          rawText: 'Pre-cached financial data for Q4 2024 - Based on actual OCR extraction',
        },
      },
      {
        quarter: 'Q1',
        year: 2025,
        imageUrls: [
          'https://discuss.ens.domains/uploads/db9688/original/2X/c/ce762dfc423f269864fd98a3f2c0ae2c5ef42c5e.png',
          'https://discuss.ens.domains/uploads/db9688/original/2X/0/04aac8f3fa4755ca5dc2a94ae55abe11b0300972.png',
        ],
        // Pre-cached data for Q1 2025 based on actual financial reports
        extractedData: {
          revenue: 153038.12,
          expenses: 99291.75,
          netIncome: 53746.37,
          assets: 280371.82,
          liabilities: 18641.57,
          equity: 280371.82,
          customMetrics: {
            eth_holdings: 61.781,
            eth_price: 1823.48,
            eth_value: 112656.84,
            ens_holdings: 5540.029,
            ens_price: 15.82,
            ens_value: 87643.27,
            usdcx_holdings: 39932.59,
            usdc_holdings: 58780.69,
            unreimbursed_admin_costs: 18641.57,
            income_ens_dao_stream: 123287.66,
            income_ens_dao_vesting: 29741.67,
            expense_team: 85244.88,
            expense_services: 12740.69,
            expense_conferences_travel: 658.17,
            expense_accounting: 445.73,
          },
          rawText: 'Pre-cached financial data for Q1 2025 - Based on actual OCR extraction',
        },
      },
      {
        quarter: 'Q2',
        year: 2025,
        imageUrls: [
          'https://discuss.ens.domains/uploads/db9688/original/2X/b/b2b1c0b8f3961a9edd7c7e0b58f37b6e606a1058.jpeg',
          'https://discuss.ens.domains/uploads/db9688/original/2X/9/955551005f60b3ba73e1c5d87be1ee910684faf5.jpeg',
        ],
        // Pre-cached data for Q2 2025 based on actual financial reports
        extractedData: {
          revenue: 148890.2,
          expenses: 103413.67,
          netIncome: 45476.53,
          assets: 382787.42,
          liabilities: 4964.15,
          equity: 382787.42,
          customMetrics: {
            eth_holdings: 61.779,
            eth_price: 2486.46,
            eth_value: 153611.58,
            ens_holdings: 6790.029,
            ens_price: 18.83,
            ens_value: 127856.26,
            usdcx_holdings: 81225.19,
            usdc_holdings: 25058.54,
            unreimbursed_admin_costs: 4964.15,
            income_ens_dao_stream: 124657.51,
            income_ens_dao_vesting: 24233.35,
            income_realized_gain_loss: -0.66,
            expense_accounting: 1009.9,
            expense_conferences_travel: 1462.4,
            expense_eth_gas: 3.92,
            expense_services: 4337.45,
            expense_team: 96600.0,
          },
          rawText: 'Pre-cached financial data for Q2 2025 - Based on actual OCR extraction',
        },
      },
    ];

    reportsData.forEach((report) => {
      const key = `${report.year}-${report.quarter}`;
      this.reports.set(key, report);
    });
  }

  async getAvailableReports(): Promise<{ quarter: string; year: number }[]> {
    return Array.from(this.reports.values()).map((report) => ({
      quarter: report.quarter,
      year: report.year,
    }));
  }

  async getReportByQuarter(quarter: string, year: number): Promise<FinancialReport | null> {
    const key = `${year}-${quarter}`;
    return this.reports.get(key) || null;
  }

  async extractDataFromImages(imageUrls: string[]): Promise<ExtractedFinancialData> {
    const extractedTexts: string[] = [];

    // Process images in parallel with timeout protection
    const ocrPromises = imageUrls.map(async (imageUrl) => {
      try {
        // Add timeout wrapper (15 seconds per image)
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('OCR timeout')), 15000);
        });

        const ocrPromise = this.ocrSpaceExtract(imageUrl);

        const ocrText = await Promise.race([ocrPromise, timeoutPromise]);
        return ocrText;
      } catch (error) {
        console.error(`Error processing image ${imageUrl}:`, error);
        return '';
      }
    });

    // Wait for all OCR operations to complete (or timeout)
    const results = await Promise.all(ocrPromises);
    extractedTexts.push(...results);

    const combinedText = extractedTexts.join('\n\n');
    return this.parseFinancialData(combinedText);
  }

  // OCR.space implementation (recommended for quick setup)
  private async ocrSpaceExtract(imageUrl: string): Promise<string> {
    const formData = new FormData();
    formData.append('url', imageUrl);
    formData.append('apikey', this.env.OCR_SPACE_API_KEY!);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // OCR Engine 2 is better for structured documents

    // Add AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

    try {
      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = (await response.json()) as {
        OCRExitCode: number;
        ParsedResults: { ParsedText: string }[];
        ErrorMessage: string;
      };

      if (result.OCRExitCode === 1 && result.ParsedResults?.[0]) {
        return result.ParsedResults[0].ParsedText || '';
      }

      throw new Error(`OCR failed: ${result.ErrorMessage || 'Unknown error'}`);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('OCR request timed out');
      }
      throw error;
    }
  }

  // Enhanced parsing for financial data with quarter-specific extraction
  private parseFinancialData(text: string): ExtractedFinancialData {
    const data: ExtractedFinancialData = {
      rawText: text,
      customMetrics: {},
    };

    // Parse income statement and balance sheet sections
    this.parseIncomeStatement(text, data);
    this.parseBalanceSheet(text, data);

    return data;
  }

  // Parse income statement with quarter-specific column detection
  private parseIncomeStatement(text: string, data: ExtractedFinancialData): void {
    const lines = text.split('\n');

    // Detect which quarter columns are present and find target column
    const quarterColumns = this.detectQuarterColumns(text);
    const targetColumn = this.findTargetQuarter(quarterColumns, text);

    if (!targetColumn) {
      console.log('No target quarter column detected, attempting fallback extraction');
      // Try fallback extraction for cases where column detection fails
      this.extractWithFallback(text, data);
      return;
    }

    console.log(`Target column detected: ${targetColumn.dateRange} at position ${targetColumn.position}`);

    // Find Total Income line and extract value for target quarter
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes('Total Income')) {
        // Look for values on this line or next few lines
        const incomeValue = this.extractValueAtPosition(lines, i, targetColumn);
        if (incomeValue !== null) {
          data.revenue = Math.abs(incomeValue);
          console.log(`Extracted revenue: ${data.revenue}`);
        }
      }

      if (line.includes('Total Expenses')) {
        const expenseValue = this.extractValueAtPosition(lines, i, targetColumn);
        if (expenseValue !== null) {
          data.expenses = Math.abs(expenseValue);
          console.log(`Extracted expenses: ${data.expenses}`);
        }
      }
    }

    // Calculate net income
    if (data.revenue !== undefined && data.expenses !== undefined) {
      data.netIncome = data.revenue - data.expenses;
    }

    // Extract individual line items
    this.extractLineItems(lines, targetColumn, data);
  }

  // Detect quarter columns from header patterns
  private detectQuarterColumns(text: string): Array<{ dateRange: string; position: number }> {
    const quarterPatterns = [/(\d{1,2}\/\d{1,2}\/\d{2,4}\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4})/g, /(Through\s+\d{4})/g];

    const columns: Array<{ dateRange: string; position: number }> = [];

    for (const pattern of quarterPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        columns.push({
          dateRange: match[1],
          position: match.index,
        });
      }
    }

    console.log(
      `Detected ${columns.length} quarter columns:`,
      columns.map((c) => c.dateRange),
    );

    // Sort by position in text
    return columns.sort((a, b) => a.position - b.position);
  }

  // Find the target quarter based on report structure
  private findTargetQuarter(
    columns: Array<{ dateRange: string; position: number }>,
    text: string,
  ): { dateRange: string; position: number; columnIndex: number } | null {
    if (columns.length === 0) return null;

    // Identify the report type and target the most recent complete quarter
    // For cumulative reports (Through 2024), find the most recent quarter column
    // For quarterly reports, find the specific quarter being reported

    let bestColumn = null;
    let bestColumnIndex = -1;

    // Check for specific quarters in priority order (most recent first)
    const quarterPriority = [
      { pattern: /4\/1\/25\s*-\s*6\/30\/25/, name: 'Q2 2025' }, // Q2 2025
      { pattern: /1\/1\/25\s*-\s*3\/31\/25/, name: 'Q1 2025' }, // Q1 2025
      { pattern: /10\/1\/24\s*-\s*12\/31\/24/, name: 'Q4 2024' }, // Q4 2024
      { pattern: /7\/1\/24\s*-\s*9\/30\/24/, name: 'Q3 2024' }, // Q3 2024
      { pattern: /4\/1\/24\s*-\s*6\/30\/24/, name: 'Q2 2024' }, // Q2 2024
    ];

    // Try to find highest priority quarter
    for (const { pattern, name } of quarterPriority) {
      const matchingColumnIndex = columns.findIndex((col) => pattern.test(col.dateRange));
      if (matchingColumnIndex !== -1) {
        bestColumn = columns[matchingColumnIndex];
        bestColumnIndex = matchingColumnIndex;
        console.log(`Found target quarter: ${name}`);
        break;
      }
    }

    // If no specific quarter found, use the last column (usually most recent)
    if (!bestColumn && columns.length > 0) {
      bestColumn = columns[columns.length - 1];
      bestColumnIndex = columns.length - 1;
      console.log(`Using fallback column: ${bestColumn.dateRange}`);
    }

    return bestColumn ? { ...bestColumn, columnIndex: bestColumnIndex } : null;
  }

  // Extract value at specific position (column) from table
  private extractValueAtPosition(
    lines: string[],
    startLine: number,
    targetColumn: { dateRange: string; position: number; columnIndex: number },
  ): number | null {
    // Look at the current line and next few lines for values
    for (let i = startLine; i < Math.min(startLine + 3, lines.length); i++) {
      const line = lines[i];
      const values = this.extractAllNumbersFromLine(line);

      if (values.length > 0) {
        // Use column index to select the right value
        // Column index represents the chronological position of quarters

        if (values.length > targetColumn.columnIndex) {
          return values[targetColumn.columnIndex];
        }

        // Smart fallback based on known patterns
        if (targetColumn.dateRange.includes('10/1/24 - 12/31/24')) {
          // Q4 2024 - usually the last or second-to-last value
          return values[values.length - 1];
        } else if (targetColumn.dateRange.includes('1/1/25 - 3/31/25')) {
          // Q1 2025 - usually appears as second column in newer reports
          return values.length >= 2 ? values[1] : values[0];
        } else if (targetColumn.dateRange.includes('4/1/25 - 6/30/25')) {
          // Q2 2025 - usually the last value in most recent reports
          return values[values.length - 1];
        } else if (targetColumn.dateRange.includes('7/1/24 - 9/30/24')) {
          // Q3 2024 - often second-to-last in multi-quarter reports
          return values.length >= 2 ? values[values.length - 2] : values[0];
        } else if (targetColumn.dateRange.includes('4/1/24 - 6/30/24')) {
          // Q2 2024 - first quarter column
          return values.length >= 2 ? values[1] : values[0];
        }

        // Default fallback
        return values[Math.min(targetColumn.columnIndex, values.length - 1)];
      }
    }

    return null;
  }

  // Extract all numbers from a line (currency values and parentheses)
  private extractAllNumbersFromLine(line: string): number[] {
    const numbers: number[] = [];

    // Pattern for currency values $123,456.78
    const currencyPattern = /\$\s*([\d,]+(?:\.\d+)?)/g;
    let match;
    while ((match = currencyPattern.exec(line)) !== null) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) {
        numbers.push(value);
      }
    }

    // Pattern for negative values in parentheses (123,456.78) or ($123,456.78)
    const negativePattern = /\(\s*\$?\s*([\d,]+(?:\.\d+)?)\s*\)/g;
    while ((match = negativePattern.exec(line)) !== null) {
      const value = -parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) {
        numbers.push(value);
      }
    }

    return numbers;
  }

  // Extract individual line items (income sources, expense categories)
  private extractLineItems(
    lines: string[],
    targetColumn: { dateRange: string; position: number; columnIndex: number },
    data: ExtractedFinancialData,
  ): void {
    const incomeItems = [
      { pattern: /ENS DAO Service Provider Stream/i, key: 'ens_dao_stream' },
      { pattern: /ENS DAO Service Provider Vesting/i, key: 'ens_dao_vesting' },
      { pattern: /MASK Network Grant/i, key: 'mask_grant' },
      { pattern: /Realized Gain\/Loss/i, key: 'realized_gain_loss' },
    ];

    const expenseItems = [
      { pattern: /Accounting/i, key: 'accounting' },
      { pattern: /Bounties/i, key: 'bounties' },
      { pattern: /Conferences?\s*&?\s*Travel/i, key: 'conferences_travel' },
      { pattern: /ETH Gas Transactions/i, key: 'eth_gas' },
      { pattern: /Legal Services/i, key: 'legal_services' },
      { pattern: /Other/i, key: 'other' },
      { pattern: /POAP/i, key: 'poap' },
      { pattern: /Services/i, key: 'services' },
      { pattern: /Team/i, key: 'team' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check income items
      for (const item of incomeItems) {
        if (item.pattern.test(line)) {
          const value = this.extractValueAtPosition(lines, i, targetColumn);
          if (value !== null) {
            data.customMetrics![`income_${item.key}`] = value;
          }
        }
      }

      // Check expense items
      for (const item of expenseItems) {
        if (item.pattern.test(line) && !line.includes('Total')) {
          const value = this.extractValueAtPosition(lines, i, targetColumn);
          if (value !== null) {
            data.customMetrics![`expense_${item.key}`] = Math.abs(value);
          }
        }
      }
    }
  }

  // Parse balance sheet (Summary of Assets & Liabilities)
  private parseBalanceSheet(text: string, data: ExtractedFinancialData): void {
    // Find the balance sheet section
    const balanceSheetMatch = text.match(/Summary of Assets & Liabilities[\s\S]*?(?=\n\n|\Z)/i);
    if (!balanceSheetMatch) {
      return;
    }

    const balanceSheetText = balanceSheetMatch[0];
    const lines = balanceSheetText.split('\n');

    for (const line of lines) {
      // Parse ETH holdings: ETH (61.763 @ $3,332.53)
      const ethMatch = line.match(/ETH\s*\(([\d,.]+)\s*@\s*\$([\d,]+(?:\.\d+)?)\)/i);
      if (ethMatch) {
        const quantity = parseFloat(ethMatch[1].replace(/,/g, ''));
        const price = parseFloat(ethMatch[2].replace(/,/g, ''));
        const value = quantity * price;

        data.customMetrics!['eth_holdings'] = quantity;
        data.customMetrics!['eth_price'] = price;
        data.customMetrics!['eth_value'] = value;
      }

      // Parse ENS holdings: ENS (4290.029 @ $33.67)
      const ensMatch = line.match(/ENS\s*\(([\d,.]+)\s*@\s*\$([\d,]+(?:\.\d+)?)\)/i);
      if (ensMatch) {
        const quantity = parseFloat(ensMatch[1].replace(/,/g, ''));
        const price = parseFloat(ensMatch[2].replace(/,/g, ''));
        const value = quantity * price;

        data.customMetrics!['ens_holdings'] = quantity;
        data.customMetrics!['ens_price'] = price;
        data.customMetrics!['ens_value'] = value;
      }

      // Parse USDC/USDCx holdings
      const usdcMatch = line.match(/(USDC[xX]?)\s*\$\s*([\d,]+(?:\.\d+)?)/i);
      if (usdcMatch) {
        const currency = usdcMatch[1].toLowerCase();
        const value = parseFloat(usdcMatch[2].replace(/,/g, ''));
        data.customMetrics![`${currency}_holdings`] = value;
      }

      // Parse Net total assets
      const netMatch = line.match(/^Net\s*\$\s*([\d,]+(?:\.\d+)?)/i);
      if (netMatch) {
        const netAssets = parseFloat(netMatch[1].replace(/,/g, ''));
        data.assets = netAssets;
        data.equity = netAssets;
      }

      // Parse Unreimbursed Admin Costs (liabilities)
      const liabilityMatch = line.match(/Unreimbursed.*\$\s*\(([\d,]+(?:\.\d+)?)\)/i);
      if (liabilityMatch) {
        const liability = parseFloat(liabilityMatch[1].replace(/,/g, ''));
        data.liabilities = liability;
        data.customMetrics!['unreimbursed_admin_costs'] = liability;
      }
    }
  }

  async processAndCacheReport(quarter: string, year: number, forceRefresh: boolean = false): Promise<FinancialReport | null> {
    const report = await this.getReportByQuarter(quarter, year);
    if (!report) return null;

    if (!report.extractedData || forceRefresh) {
      report.extractedData = await this.extractDataFromImages(report.imageUrls);
      // Cache the extracted data
      const key = `${year}-${quarter}`;
      this.reports.set(key, report);
    }

    return report;
  }

  private parseNumberValue(numberStr: string, fullMatch: string): number {
    const cleanNumber = parseFloat(numberStr.replace(/,/g, ''));

    // Check for multipliers
    if (fullMatch.match(/billion|B/i)) {
      return cleanNumber * 1000000000;
    } else if (fullMatch.match(/million|M/i)) {
      return cleanNumber * 1000000;
    } else if (fullMatch.match(/thousand|K/i)) {
      return cleanNumber * 1000;
    }

    return cleanNumber;
  }

  // Fallback extraction method for when column detection fails
  private extractWithFallback(text: string, data: ExtractedFinancialData): void {
    console.log('Using fallback extraction method');

    // Look for specific patterns in the Q2 2024 format
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for "Total Income" line followed by values
      if (line.includes('Total Income')) {
        // In Q2 2024 format, the next few lines should contain the values
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const valueLine = lines[j];
          const values = this.extractAllNumbersFromLine(valueLine);

          // Look for the pattern where we have multiple values
          // Q2 2024 pattern: (12.79) $ 124,672.65 $ 205,760.97
          if (values.length >= 2) {
            // Usually the second-to-last or last value is the quarterly value
            const quarterlyValue = values.length >= 3 ? values[values.length - 2] : values[values.length - 1];
            if (quarterlyValue > 1000) {
              // Reasonable revenue threshold
              data.revenue = Math.abs(quarterlyValue);
              console.log(`Fallback extracted revenue: ${data.revenue}`);
              break;
            }
          }
        }
      }

      // Look for "Total Expenses" line
      if (line.includes('Total Expenses')) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const valueLine = lines[j];
          const values = this.extractAllNumbersFromLine(valueLine);

          if (values.length >= 2) {
            // Look for negative values or large positive values
            const expenseValue = values.find((v) => Math.abs(v) > 1000);
            if (expenseValue !== undefined) {
              data.expenses = Math.abs(expenseValue);
              console.log(`Fallback extracted expenses: ${data.expenses}`);
              break;
            }
          }
        }
      }

      // Look for Net value - in Q2 2024, it shows "61,954.90 $ 135,760.97"
      if (line.includes('Net') && !line.includes('Total') && !line.includes('Income')) {
        const values = this.extractAllNumbersFromLine(line);
        if (values.length >= 1) {
          const netValue = values[0]; // First value is usually the quarterly net
          if (Math.abs(netValue) > 1000) {
            data.netIncome = netValue;
            console.log(`Fallback extracted net income: ${data.netIncome}`);
          }
        }
      }
    }

    // Calculate net income if we have revenue and expenses but no net income
    if (data.revenue !== undefined && data.expenses !== undefined && data.netIncome === undefined) {
      data.netIncome = data.revenue - data.expenses;
      console.log(`Calculated net income: ${data.netIncome}`);
    }
  }
}
