import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import router from './Service/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors({
  origin:"https://frontend-chatbot-blush.vercel.app",
  credentials: true,
}));


app.use(express.json());
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};


app.use('/api', router);


app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});


app.get('/', (req, res) => {
    res.json({
        name: 'AI Customer Support Backend',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            api: '/api',
        }
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});


const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log('');
            console.log('═══════════════════════════════════════════════════════');
            console.log('🚀 AI Customer Support Backend Server Started');
            console.log('═══════════════════════════════════════════════════════');
            console.log(`📡 Server running on: http://localhost:${PORT}`);
            console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
            console.log(`💚 Health check: http://localhost:${PORT}/health`);
            console.log(`📊 API base route: http://localhost:${PORT}/api`);
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    process.exit(1);
});

startServer();