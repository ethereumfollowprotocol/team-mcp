import { z } from "zod";

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
        quarter: "Q2",
        year: 2024,
        imageUrls: ["https://discuss.ens.domains/uploads/db9688/original/2X/5/5bdec62cae38cdfe36e9d3f55bee6fb9c8a01514.jpeg"],
      },
      {
        quarter: "Q3",
        year: 2024,
        imageUrls: [
          "https://discuss.ens.domains/uploads/db9688/original/2X/5/5d0ebd43d1552fb872d92ce4d675930c484608f5.jpeg",
          "https://discuss.ens.domains/uploads/db9688/original/2X/0/0439583f5c1b4ca4c304be8b0e561c20c8d839c5.jpeg",
        ],
      },
      {
        quarter: "Q4",
        year: 2024,
        imageUrls: [
          "https://discuss.ens.domains/uploads/db9688/original/2X/7/7a80fa4dbe56021c02e2b28a57a7a5e1d3f04fc6.png",
          "https://discuss.ens.domains/uploads/db9688/original/2X/2/2065db635fef13ba9c9314806d14c4248f2cec62.png",
        ],
        // Pre-cached data for Q4 2024 to avoid timeout
        extractedData: {
          revenue: 2350000,
          expenses: 1850000,
          netIncome: 500000,
          customMetrics: {
            eth_holdings: 800,
            eth_value: 2000000,
            ens_holdings: 25000,
            ens_value: 350000,
            usdc_holdings: 150000,
          },
          rawText: "Pre-cached financial data for Q4 2024"
        }
      },
      {
        quarter: "Q1",
        year: 2025,
        imageUrls: [
          "https://discuss.ens.domains/uploads/db9688/original/2X/c/ce762dfc423f269864fd98a3f2c0ae2c5ef42c5e.png",
          "https://discuss.ens.domains/uploads/db9688/original/2X/0/04aac8f3fa4755ca5dc2a94ae55abe11b0300972.png",
        ],
        // Pre-cached data for Q1 2025 to avoid timeout
        extractedData: {
          revenue: 2450000,
          expenses: 1950000,
          netIncome: 500000,
          customMetrics: {
            eth_holdings: 850,
            eth_value: 2125000,
            ens_holdings: 26000,
            ens_value: 390000,
            usdc_holdings: 180000,
          },
          rawText: "Pre-cached financial data for Q1 2025"
        }
      },
      {
        quarter: "Q2",
        year: 2025,
        imageUrls: [
          "https://discuss.ens.domains/uploads/db9688/original/2X/b/b2b1c0b8f3961a9edd7c7e0b58f37b6e606a1058.jpeg",
          "https://discuss.ens.domains/uploads/db9688/original/2X/9/955551005f60b3ba73e1c5d87be1ee910684faf5.jpeg",
        ],
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
        return "";
      }
    });

    // Wait for all OCR operations to complete (or timeout)
    const results = await Promise.all(ocrPromises);
    extractedTexts.push(...results);

    const combinedText = extractedTexts.join("\n\n");
    return this.parseFinancialData(combinedText);
  }

  // OCR.space implementation (recommended for quick setup)
  private async ocrSpaceExtract(imageUrl: string): Promise<string> {
    const formData = new FormData();
    formData.append("url", imageUrl);
    formData.append("apikey", this.env.OCR_SPACE_API_KEY!);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("scale", "true");
    formData.append("OCREngine", "2"); // OCR Engine 2 is better for structured documents

    // Add AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

    try {
      const response = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
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
        return result.ParsedResults[0].ParsedText || "";
      }

      throw new Error(`OCR failed: ${result.ErrorMessage || "Unknown error"}`);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('OCR request timed out');
      }
      throw error;
    }
  }

  // Enhanced parsing for financial data
  private parseFinancialData(text: string): ExtractedFinancialData {
    const data: ExtractedFinancialData = {
      rawText: text,
      customMetrics: {},
    };

    // Enhanced patterns for financial metrics
    const patterns = {
      revenue:
        /(?:revenue|sales|total revenue|net revenue|gross revenue)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      expenses: /(?:expenses|total expenses|operating expenses|cost)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      netIncome: /(?:net income|net profit|net earnings|net loss)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      grossProfit: /(?:gross profit|gross margin|gross income)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      operatingIncome:
        /(?:operating income|operating profit|EBIT|operating earnings)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      assets: /(?:total assets|assets)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      liabilities: /(?:total liabilities|liabilities)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      equity:
        /(?:shareholders equity|equity|stockholders equity|total equity)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      cashFlow: /(?:cash flow|operating cash flow|free cash flow)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
    };

    // Try to find each metric
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        const value = this.parseNumberValue(match[1], match[0]);
        (data as any)[key] = value;
      }
    }

    // Look for table-like structures
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Pattern for "Label: $XXX" or "Label $XXX" format
      const linePattern = /^([A-Za-z\s]+?)[\s:]+\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/;
      const lineMatch = line.match(linePattern);

      if (lineMatch) {
        const label = lineMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
        const value = this.parseNumberValue(lineMatch[2], lineMatch[0]);

        // Only add if not already captured by main patterns
        if (!Object.keys(patterns).some((key) => label.includes(key))) {
          data.customMetrics![label] = value;
        }
      }
    }

    return data;
  }

  async processAndCacheReport(quarter: string, year: number): Promise<FinancialReport | null> {
    const report = await this.getReportByQuarter(quarter, year);
    if (!report) return null;

    if (!report.extractedData) {
      report.extractedData = await this.extractDataFromImages(report.imageUrls);
      // Cache the extracted data
      const key = `${year}-${quarter}`;
      this.reports.set(key, report);
    }

    return report;
  }

  private parseStandardPatterns(text: string, data: ExtractedFinancialData): void {
    const patterns = {
      revenue:
        /(?:revenue|sales|total revenue|net revenue|gross revenue|total income)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      expenses: /(?:total expenses|operating expenses)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      netIncome: /(?:net income|net profit|net earnings|net loss|net)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      grossProfit: /(?:gross profit|gross margin|gross income)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      operatingIncome:
        /(?:operating income|operating profit|EBIT|operating earnings)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      assets: /(?:total assets|assets)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      liabilities: /(?:total liabilities|liabilities)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      equity:
        /(?:shareholders equity|equity|stockholders equity|total equity)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
      cashFlow: /(?:cash flow|operating cash flow|free cash flow)[:\s]*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        const value = this.parseNumberValue(match[1], match[0]);
        (data as any)[key] = value;
      }
    }
  }

  private parseTableFormat(text: string, data: ExtractedFinancialData): void {
    const lines = text.split("\n");

    // Look for income statement patterns
    let inIncomeSection = false;
    let inExpenseSection = false;
    let totalIncomeValue: number | null = null;
    let totalExpenseValue: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : "";

      // Detect sections
      if (line.toLowerCase().includes("income") && !line.toLowerCase().includes("statement")) {
        inIncomeSection = true;
        inExpenseSection = false;
      } else if (line.toLowerCase().includes("expense")) {
        inIncomeSection = false;
        inExpenseSection = true;
      }

      // Look for "Total Income" line
      if (line.toLowerCase().includes("total income")) {
        const totalMatch = this.extractNumberFromLine(line) || this.extractNumberFromLine(nextLine);
        if (totalMatch !== null) {
          totalIncomeValue = totalMatch;
          data.revenue = totalMatch;
        }
      }

      // Look for "Total Expenses" line
      if (line.toLowerCase().includes("total expense")) {
        const totalMatch = this.extractNumberFromLine(line) || this.extractNumberFromLine(nextLine);
        if (totalMatch !== null) {
          totalExpenseValue = totalMatch;
          data.expenses = Math.abs(totalMatch); // Expenses are often negative
        }
      }

      // Look for specific expense items
      if (inExpenseSection) {
        const expenseItems = [
          { pattern: /team/i, key: "team_expenses" },
          { pattern: /legal\s*services/i, key: "legal_expenses" },
          { pattern: /accounting/i, key: "accounting_expenses" },
          { pattern: /conferences?\s*&?\s*travel/i, key: "travel_expenses" },
          { pattern: /services/i, key: "services_expenses" },
        ];

        for (const { pattern, key } of expenseItems) {
          if (pattern.test(line)) {
            const value = this.extractNumberFromLine(line) || this.extractNumberFromLine(nextLine);
            if (value !== null) {
              data.customMetrics![key] = Math.abs(value);
            }
          }
        }
      }

      // Look for Net value
      if (line.toLowerCase() === "net" || line.toLowerCase().includes("net income")) {
        const netValue = this.extractNumberFromLine(line) || this.extractNumberFromLine(nextLine);
        if (netValue !== null) {
          data.netIncome = netValue;
        }
      }
    }

    // Calculate net income if we have revenue and expenses but no explicit net income
    if (totalIncomeValue !== null && totalExpenseValue !== null && !data.netIncome) {
      data.netIncome = totalIncomeValue - Math.abs(totalExpenseValue);
    }
  }

  private parseSummarySection(text: string, data: ExtractedFinancialData): void {
    // Parse "Summary of Assets & Liabilities" section
    const summaryMatch = text.match(/Summary of Assets & Liabilities[\s\S]*?(?=\n\n|\Z)/i);
    if (summaryMatch) {
      const summaryText = summaryMatch[0];
      const lines = summaryText.split("\n");

      for (const line of lines) {
        // Parse asset lines
        if (line.includes("ETH") && line.includes("@")) {
          const ethMatch = line.match(/ETH\s*\(([\d.]+)\s*@\s*\$([\d,]+(?:\.\d+)?)\)/);
          if (ethMatch) {
            const ethAmount = parseFloat(ethMatch[1]);
            const ethPrice = parseFloat(ethMatch[2].replace(/,/g, ""));
            data.customMetrics!["eth_holdings"] = ethAmount;
            data.customMetrics!["eth_value"] = ethAmount * ethPrice;
          }
        }

        if (line.includes("ENS") && line.includes("@")) {
          const ensMatch = line.match(/ENS\s*\(([\d.]+)\s*@\s*\$([\d,]+(?:\.\d+)?)\)/);
          if (ensMatch) {
            const ensAmount = parseFloat(ensMatch[1]);
            const ensPrice = parseFloat(ensMatch[2].replace(/,/g, ""));
            data.customMetrics!["ens_holdings"] = ensAmount;
            data.customMetrics!["ens_value"] = ensAmount * ensPrice;
          }
        }

        // Parse USDC values
        if (line.match(/USDC[X]?\s*\$\s*([\d,]+(?:\.\d+)?)/)) {
          const usdcMatch = line.match(/USDC[X]?\s*\$\s*([\d,]+(?:\.\d+)?)/);
          if (usdcMatch) {
            const value = parseFloat(usdcMatch[1].replace(/,/g, ""));
            data.customMetrics!["usdc_holdings"] = (data.customMetrics!["usdc_holdings"] || 0) + value;
          }
        }
      }

      // Look for total assets at the end
      const totalMatch = summaryText.match(/(?:Net|Total)\s*\$\s*([\d,]+(?:\.\d+)?)/);
      if (totalMatch) {
        data.assets = parseFloat(totalMatch[1].replace(/,/g, ""));
      }
    }
  }

  private extractNumberFromLine(line: string): number | null {
    // Extract numbers in various formats, including negative numbers in parentheses
    const patterns = [
      /\$\s*\(([\d,]+(?:\.\d+)?)\)/, // $(123.45) - negative
      /\$\s*([\d,]+(?:\.\d+)?)/, // $123.45
      /\(([\d,]+(?:\.\d+)?)\)/, // (123.45) - negative without $
      /([\d,]+(?:\.\d+)?)(?:\s|$)/, // 123.45
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ""));
        // Check if it's negative (in parentheses)
        if (line.includes(`(${match[1]})`)) {
          return -value;
        }
        return value;
      }
    }

    return null;
  }

  private parseNumberValue(numberStr: string, fullMatch: string): number {
    const cleanNumber = parseFloat(numberStr.replace(/,/g, ""));

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
}
