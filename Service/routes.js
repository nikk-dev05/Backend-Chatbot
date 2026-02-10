import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User, Conversation, Message } from '../models/model.js';
import { generateToken } from '../Middlewares/authmiddlewares.js';
import { aiService } from './Aiservice.js';
import { emailService } from './Emailservice.js';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({
        ctx: {
            user: ctx.user,
        },
    });
});

const protectedProcedure = t.procedure.use(isAuthed);
export const appRouter = router({
    auth: router({
        register: publicProcedure
            .input(z.object({
                name: z.string().min(2),
                email: z.string().email(),
                password: z.string().min(8),
            }))
            .mutation(async ({ input }) => {
                try {
                
                    const existingUser = await User.findOne({ email: input.email });
                    if (existingUser) {
                        throw new TRPCError({
                            code: 'CONFLICT',
                            message: 'An account with this email already exists',
                        });
                    }

                
                    const hashedPassword = await bcrypt.hash(input.password, 10);

        
                    const user = await User.create({
                        name: input.name,
                        email: input.email,
                        password: hashedPassword,
                    });

        
                    const token = generateToken(user._id);

                    return {
                        success: true,
                        data: {
                            token,
                            user: {
                                id: user._id,
                                name: user.name,
                                email: user.email,
                            },
                        },
                    };
                } catch (error) {
                    if (error instanceof TRPCError) throw error;
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Registration failed',
                    });
                }
            }),


        login: publicProcedure
            .input(z.object({
                email: z.string().email(),
                password: z.string(),
            }))
            .mutation(async ({ input }) => {
                try {
                
                    const user = await User.findOne({ email: input.email });
                    if (!user) {
                        throw new TRPCError({
                            code: 'UNAUTHORIZED',
                            message: 'Invalid email or password',
                        });
                    }

            
                    const isValidPassword = await bcrypt.compare(input.password, user.password);
                    if (!isValidPassword) {
                        throw new TRPCError({
                            code: 'UNAUTHORIZED',
                            message: 'Invalid email or password',
                        });
                    }
                    const token = generateToken(user._id);

                    return {
                        success: true,
                        data: {
                            token,
                            user: {
                                id: user._id,
                                name: user.name,
                                email: user.email,
                            },
                        },
                    };
                } catch (error) {
                    if (error instanceof TRPCError) throw error;
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Login failed',
                    });
                }
            }),
        forgotPassword: publicProcedure
            .input(z.object({
                email: z.string().email(),
            }))
            .mutation(async ({ input }) => {
                try {
                    const user = await User.findOne({ email: input.email });
                    if (user) {
                        const resetToken = generateToken(user._id);
                        await emailService.sendPasswordReset(input.email, resetToken);
                    }

                    return {
                        success: true,
                        data: {
                            message: 'If an account exists with this email, a password reset link has been sent.',
                        },
                    };
                } catch (error) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Failed to process password reset',
                    });
                }
            }),
    }),
    conversation: router({
        
        create: protectedProcedure
            .mutation(async ({ ctx }) => {
                try {
                    const conversation = await Conversation.create({
                        userId: ctx.user._id,
                        title: 'New Conversation',
                        preview: '',
                    });

                    return {
                        success: true,
                        data: {
                            conversationId: conversation._id,
                            timestamp: conversation.createdAt,
                        },
                    };
                } catch (error) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Failed to create conversation',
                    });
                }
            }),

    
        list: protectedProcedure
            .query(async ({ ctx }) => {
                try {
                    const conversations = await Conversation.find({ userId: ctx.user._id })
                        .sort({ updatedAt: -1 })
                        .limit(50);

                    return {
                        success: true,
                        data: conversations.map(conv => ({
                            id: conv._id,
                            title: conv.title,
                            preview: conv.preview,
                            timestamp: conv.updatedAt,
                            status: conv.status,
                            escalated: conv.escalated,
                        })),
                    };
                } catch (error) {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Failed to load conversations',
                    });
                }
            }),

    
        delete: protectedProcedure
            .input(z.object({
                conversationId: z.string(),
            }))
            .mutation(async ({ ctx, input }) => {
                try {
                    const conversation = await Conversation.findOne({
                        _id: input.conversationId,
                        userId: ctx.user._id,
                    });

                    if (!conversation) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Conversation not found',
                        });
                    }

                
                    await Message.deleteMany({ conversationId: input.conversationId });
                    
            
                    await conversation.deleteOne();

                    return {
                        success: true,
                        data: { message: 'Conversation deleted successfully' },
                    };
                } catch (error) {
                    if (error instanceof TRPCError) throw error;
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Failed to delete conversation',
                    });
                }
            }),
    }),
    message: router({

        send: protectedProcedure
            .input(z.object({
                conversationId: z.string(),
                message: z.string(),
            }))
            .mutation(async ({ ctx, input }) => {
                try {
                    
                    const conversation = await Conversation.findOne({
                        _id: input.conversationId,
                        userId: ctx.user._id,
                    });

                    if (!conversation) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Conversation not found',
                        });
                    }

                
                    const userMessage = await Message.create({
                        conversationId: input.conversationId,
                        role: 'user',
                        text: input.message,
                    });

            
                    const aiResponse = await aiService.generateResponse(
                        input.conversationId,
                        input.message
                    );

            
                    const assistantMessage = await Message.create({
                        conversationId: input.conversationId,
                        role: 'assistant',
                        text: aiResponse.text,
                    });
                    conversation.preview = input.message.substring(0, 100);
                    if (conversation.title === 'New Conversation') {
                        conversation.title = input.message.substring(0, 50);
                    }
                    conversation.updatedAt = new Date();
                    await conversation.save();
                    const shouldEscalate = await aiService.shouldEscalate(input.conversationId);

                    return {
                        success: true,
                        data: {
                            messageId: assistantMessage._id,
                            text: aiResponse.text,
                            timestamp: assistantMessage.createdAt,
                            role: 'assistant',
                            suggestEscalation: shouldEscalate,
                        },
                    };
                } catch (error) {
                    if (error instanceof TRPCError) throw error;
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Failed to send message',
                    });
                }
            }),

        // List messages
        list: protectedProcedure
            .input(z.object({
                conversationId: z.string(),
            }))
            .query(async ({ ctx, input }) => {
                try {
                    const conversation = await Conversation.findOne({
                        _id: input.conversationId,
                        userId: ctx.user._id,
                    });

                    if (!conversation) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Conversation not found',
                        });
                    }

                    const messages = await Message.find({ conversationId: input.conversationId })
                        .sort({ createdAt: 1 });

                    return {
                        success: true,
                        data: messages.map(msg => ({
                            id: msg._id,
                            conversationId: msg.conversationId,
                            text: msg.text,
                            role: msg.role,
                            timestamp: msg.createdAt,
                        })),
                    };
                } catch (error) {
                    if (error instanceof TRPCError) throw error;
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Failed to load messages',
                    });
                }
            }),
    }),


    support: router({
    
        escalate: protectedProcedure
            .input(z.object({
                conversationId: z.string(),
                email: z.string().email(),
                notes: z.string().optional(),
            }))
            .mutation(async ({ ctx, input }) => {
                try {
                    const conversation = await Conversation.findOne({
                        _id: input.conversationId,
                        userId: ctx.user._id,
                    });

                    if (!conversation) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Conversation not found',
                        });
                    }

                    const summary = await aiService.generateSummary(input.conversationId);

                    conversation.escalated = true;
                    conversation.status = 'escalated';
                    conversation.escalationNotes = input.notes || '';
                    await conversation.save();

                    await emailService.sendEscalationNotification(
                        input.email,
                        summary,
                        input.notes
                    );

                    await emailService.sendConversationSummary(
                        input.email,
                        summary
                    );

                    return {
                        success: true,
                        data: {
                            escalationId: conversation._id,
                            message: 'Your request has been escalated to our support team. You will receive an email shortly.',
                        },
                    };
                } catch (error) {
                    if (error instanceof TRPCError) throw error;
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Failed to escalate conversation',
                    });
                }
            }),
    }),
});
