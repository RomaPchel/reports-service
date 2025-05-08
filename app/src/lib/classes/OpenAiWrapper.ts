import OpenAI from "openai";

export class OpenAiWrapper {
    private client!: OpenAI;
    private reportData: any;

    constructor(reportData: any) {
        this.reportData = reportData;
        this.setUpClient();
    }

    private setUpClient() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    public async generatePerformanceSummary(): Promise<string> {
        const prompt = this.constructPrompt(this.reportData);
        
        try {
            const response = await this.client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a marketing analytics expert that creates concise, data-driven summaries of advertising performance."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            return response.choices[0].message.content || "No summary generated";
        } catch (error) {
            console.error("Error generating performance summary:", error);
            throw new Error("Failed to generate performance summary");
        }
    }

    private constructPrompt(reportData: any): string {

        const prompt = `
Describe the data in simple words, in a way that the client of marketing agency would understand.
Don't include too much statistics and data.
Don't include any introduction like "Here's a simplified overview of your advertising performance:", 
don't include any conclusion like "Feel free to ask if you need more specific insights or have any questions!".

${JSON.stringify(reportData)}
`;

        return prompt;
    }
}
