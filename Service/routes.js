import express from 'express';
import bcrypt from 'bcryptjs';
import { User, Conversation, Message } from '../models/model.js';
import { generateToken } from '../Middlewares/authmiddlewares.js';
import { aiService } from './Aiservice.js';
import { emailService } from './Emailservice.js';

const router = express.Router();


const isAuthed = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const userId = await generateToken.verifyToken(token);
        const user = await User.findById(userId);
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
};

router.post('/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(409).json({ success: false, message: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword });
        const token = generateToken(user._id);

        res.status(201).json({ success: true, data: { token, user: { id: user._id, name: user.name, email: user.email } } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        const token = generateToken(user._id);
        res.json({ success: true, data: { token, user: { id: user._id, name: user.name, email: user.email } } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});


router.post('/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (user) {
            const resetToken = generateToken(user._id);
            await emailService.sendPasswordReset(email, resetToken);
        }
        res.json({ success: true, message: 'If an account exists, reset link sent.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to process request' });
    }
});

router.post('/conversation/create', isAuthed, async (req, res) => {
    try {
        const conversation = await Conversation.create({ userId: req.user._id, title: 'New Conversation', preview: '' });
        res.json({ success: true, data: { conversationId: conversation._id, timestamp: conversation.createdAt } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create conversation' });
    }
});

router.get('/conversation/list', isAuthed, async (req, res) => {
    try {
        const conversations = await Conversation.find({ userId: req.user._id }).sort({ updatedAt: -1 }).limit(50);
        res.json({
            success: true,
            data: conversations.map(conv => ({
                id: conv._id,
                title: conv.title,
                preview: conv.preview,
                timestamp: conv.updatedAt,
                status: conv.status,
                escalated: conv.escalated,
            })),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load conversations' });
    }
});

router.delete('/conversation/delete', isAuthed, async (req, res) => {
    try {
        const { conversationId } = req.body;
        const conversation = await Conversation.findOne({ _id: conversationId, userId: req.user._id });
        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        await Message.deleteMany({ conversationId });
        await conversation.deleteOne();

        res.json({ success: true, data: { message: 'Conversation deleted successfully' } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete conversation' });
    }
});

router.post('/message/send', isAuthed, async (req, res) => {
    try {
        const { conversationId, message } = req.body;
        const conversation = await Conversation.findOne({ _id: conversationId, userId: req.user._id });
        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const userMessage = await Message.create({ conversationId, role: 'user', text: message });
        const aiResponse = await aiService.generateResponse(conversationId, message);
        const assistantMessage = await Message.create({ conversationId, role: 'assistant', text: aiResponse.text });

        conversation.preview = message.substring(0, 100);
        if (conversation.title === 'New Conversation') conversation.title = message.substring(0, 50);
        conversation.updatedAt = new Date();
        await conversation.save();

        const shouldEscalate = await aiService.shouldEscalate(conversationId);

        res.json({
            success: true,
            data: { messageId: assistantMessage._id, text: aiResponse.text, timestamp: assistantMessage.createdAt, role: 'assistant', suggestEscalation: shouldEscalate },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

router.get('/message/list', isAuthed, async (req, res) => {
    try {
        const { conversationId } = req.query;
        const conversation = await Conversation.findOne({ _id: conversationId, userId: req.user._id });
        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
        res.json({
            success: true,
            data: messages.map(msg => ({ id: msg._id, conversationId: msg.conversationId, text: msg.text, role: msg.role, timestamp: msg.createdAt })),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load messages' });
    }
});

router.post('/support/escalate', isAuthed, async (req, res) => {
    try {
        const { conversationId, email, notes } = req.body;
        const conversation = await Conversation.findOne({ _id: conversationId, userId: req.user._id });
        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        const summary = await aiService.generateSummary(conversationId);
        conversation.escalated = true;
        conversation.status = 'escalated';
        conversation.escalationNotes = notes || '';
        await conversation.save();

        await emailService.sendEscalationNotification(email, summary, notes);
        await emailService.sendConversationSummary(email, summary);

        res.json({ success: true, data: { escalationId: conversation._id, message: 'Your request has been escalated. You will receive an email shortly.' } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to escalate conversation' });
    }
});

export default router;