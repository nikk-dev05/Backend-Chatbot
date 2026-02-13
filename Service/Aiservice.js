import dotenv from 'dotenv';
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Message } from '../models/model.js';
dotenv.config();

class AIService {
    constructor() {
        this.model = new ChatOpenAI({
    model: "openai/gpt-3.5-turbo",
    temperature: 0.7,
    maxTokens: 1024,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
    },
});

    
        this.systemPrompt = `You are a helpful and empathetic AI customer support assistant for an e-commerce company. Your role is to:

1. Understand customer queries and provide accurate, helpful information
2. Be polite, professional, and empathetic
3. Provide step-by-step solutions when needed
4. If you don't know something, admit it and offer to escalate to a human agent
5. Keep responses concise but comprehensive
6. Use markdown formatting for better readability

Guidelines:
- Always greet customers warmly
- Listen carefully to their concerns
- Provide clear, actionable solutions
- Confirm understanding before offering solutions
- End conversations positively

Current conversation:
{history}

Customer: {input}
Assistant:`;

        this.promptTemplate = PromptTemplate.fromTemplate(this.systemPrompt);
    }

    async generateResponse(conversationId, userMessage) {
    try {
        const messages = await Message.find({ conversationId })
            .sort({ createdAt: 1 })
            .limit(20);

        const history = messages.map(msg => {
            const role = msg.role === 'user' ? 'Customer' : 'Assistant';
            return `${role}: ${msg.text}`;
        }).join('\n');
        const promptString = await this.promptTemplate.format({
      history: history || "No previous conversation.",
      input: userMessage
    });

    const response = await this.model.invoke(promptString);



        return {
            success: true,
            text: response.content
        };

    } catch (error) {
        console.error('AI Service Error:', error);
        return {
            success: false,
            error: error.message,
            text: "I apologize, but I'm having trouble processing your request right now. Please try again or contact our support team directly."
        };
    }
}

    async generateSummary(conversationId) {
        try {
    
            const messages = await Message.find({ conversationId })
                .sort({ createdAt: 1 });

            if (messages.length === 0) {
                return "No messages in conversation.";
            }

            const conversationText = messages.map(msg => {
                const role = msg.role === 'user' ? 'Customer' : 'Assistant';
                return `${role}: ${msg.text}`;
            }).join('\n\n');

            const summaryPrompt = `Please provide a concise summary of the following customer support conversation. Include:
1. Main issue or question
2. Solutions attempted
3. Current status
4. What the customer needs

Conversation:
${conversationText}

Summary:`;

            const response = await this.model.invoke(summaryPrompt);

            return response.content || "Unable to generate summary.";

        } catch (error) {
            console.error('Summary Generation Error:', error);
            return "Error generating conversation summary.";
        }
    }
    async analyzeSentiment(message) {
        try {
            const sentimentPrompt = `Analyze the sentiment of this customer message and respond with only one word: positive, negative, or neutral.

Message: ${message}

Sentiment:`;

            const response = await this.model.invoke(sentimentPrompt);
            const sentiment = response.content.toLowerCase().trim();

            return ['positive', 'negative', 'neutral'].includes(sentiment) 
                ? sentiment 
                : 'neutral';

        } catch (error) {
            console.error('Sentiment Analysis Error:', error);
            return 'neutral';
        }
    }


    async shouldEscalate(conversationId) {
        try {
            const messages = await Message.find({ conversationId })
                .sort({ createdAt: 1 })
                .limit(10);

            if (messages.length < 3) {
                return false;
            }

            const conversationText = messages.map(msg => 
                `${msg.role === 'user' ? 'Customer' : 'Assistant'}: ${msg.text}`
            ).join('\n');

            const escalationPrompt = `Based on this customer support conversation, should it be escalated to a human agent? 
Consider:
- Customer frustration level
- Complexity of the issue
- Number of failed resolution attempts
- Urgency

Respond with only YES or NO.

Conversation:
${conversationText}

Should escalate:`;

            const response = await this.model.invoke(escalationPrompt);
            const decision = response.content.toUpperCase().trim();

            return decision === 'YES';

        } catch (error) {
            console.error('Escalation Check Error:', error);
            return false;
        }
    }
}

export const aiService = new AIService();