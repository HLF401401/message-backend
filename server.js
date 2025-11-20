// 加载环境变量（.env文件或Vercel环境变量）
require('dotenv').config();

// 导入核心依赖
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

// 创建Express应用实例
const app = express();
const PORT = process.env.PORT || 3000; // 端口：优先使用环境变量，默认3000

// ---------------------- 中间件配置 ----------------------
// 1. 跨域配置：仅允许你的GitHub Pages域名访问（安全限制）
app.use(cors({
    origin: 'https://hlf401401.github.io', // 必须是你的GitHub Pages域名（无斜杠）
    methods: ['POST', 'GET'], // 允许的请求方法
    allowedHeaders: ['Content-Type'] // 允许的请求头
}));

// 2. 解析JSON请求体（前端传参需要）
app.use(express.json({ limit: '1mb' })); // 限制请求体最大1MB，防止恶意请求

// ---------------------- 接口定义 ----------------------
/**
 * 测试接口：验证后端服务是否正常运行
 * 访问地址：https://你的后端地址/api/test
 * 作用：快速排查服务可用性，无需触发邮件发送
 */
app.get('/api/test', (req, res) => {
    console.log(`[${new Date().toLocaleString()}] 收到测试请求，IP：${req.ip}`);
    res.json({
        success: true,
        message: '后端服务正常运行',
        timestamp: new Date().toLocaleString(),
        tips: '请访问 /api/send-direct 接口提交留言（POST方法）'
    });
});

/**
 * 核心接口：接收前端留言，通过QQ邮箱SMTP发送到目标邮箱
 * 请求方式：POST
 * 访问地址：https://你的后端地址/api/send-direct
 * 请求体：{ senderEmail: "用户QQ邮箱", content: "留言内容" }
 * 响应：JSON格式的成功/失败提示
 */
app.post('/api/send-direct', async (req, res) => {
    try {
        // 1. 提取并验证前端传参
        const { senderEmail, content } = req.body;
        const targetEmail = process.env.TARGET_EMAIL; // 接收留言的目标邮箱（从环境变量读取）
        const authEmail = process.env.QQ_EMAIL; // SMTP认证邮箱（你的QQ邮箱）

        // 基础参数校验（防止空值或格式错误）
        if (!senderEmail || !content || !targetEmail || !authEmail) {
            console.warn(`[${new Date().toLocaleString()}] 参数不全：senderEmail=${senderEmail}, content=${content}`);
            return res.json({
                success: false,
                message: '参数不全，请填写完整的QQ邮箱和留言内容'
            });
        }

        // QQ邮箱格式校验（5-11位数字，首位非0，后缀@qq.com）
        const qqEmailReg = /^[1-9]\d{4,10}@qq\.com$/;
        if (!qqEmailReg.test(senderEmail)) {
            console.warn(`[${new Date().toLocaleString()}] 无效QQ邮箱：${senderEmail}`);
            return res.json({
                success: false,
                message: '请输入有效的QQ邮箱（格式：123456@qq.com）'
            });
        }

        // 留言长度限制（1-1000字）
        if (content.length < 1 || content.length > 1000) {
            console.warn(`[${new Date().toLocaleString()}] 留言长度异常：${content.length}字`);
            return res.json({
                success: false,
                message: '留言内容需在1-1000字之间，请精简后提交'
            });
        }

        // 2. 配置QQ邮箱SMTP服务（核心：发件人必须与认证账号一致）
        const transporter = nodemailer.createTransport({
            host: 'smtp.qq.com', // QQ邮箱SMTP服务器（固定值）
            port: 465, // SSL加密端口（固定值，必须465）
            secure: true, // 启用SSL加密（必填，否则无法连接）
            auth: {
                user: authEmail, // SMTP认证账号（你的QQ邮箱，与环境变量一致）
                pass: process.env.QQ_EMAIL_AUTH_CODE // QQ邮箱SMTP授权码（不是QQ密码）
            },
            tls: {
                rejectUnauthorized: false // 解决部分环境下的证书验证问题
            }
        });

        // 3. 构造邮件内容（明确标注用户邮箱，方便回复）
        const mailOptions = {
            from: `"用户留言反馈" <${authEmail}>`, // 发件人：你的QQ邮箱（与认证账号一致，避免501错误）
            to: targetEmail, // 收件人：你的固定目标邮箱（从环境变量读取）
            subject: `【QQ邮箱留言】来自 ${senderEmail} 的反馈`, // 邮件主题：包含用户邮箱，方便识别
            // 文本格式正文（兼容所有邮箱客户端，避免格式错乱）
            text: `===== 留言详情 =====
用户QQ邮箱（可直接回复）：${senderEmail}
留言提交时间：${new Date().toLocaleString()}
留言内容：
${content}

===== 回复说明 =====
直接回复此邮件，收件人会自动填充为用户的QQ邮箱，无需手动输入`,
            // HTML格式正文（更美观，支持换行、高亮样式）
            html: `
                <div style="font-family: 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto;">
                    <h3 style="color: #2d3748; border-bottom: 2px solid #4299e1; padding-bottom: 8px;">===== 留言详情 =====</h3>
                    <p style="margin: 12px 0; color: #4a5568;">
                        <strong>用户QQ邮箱（可直接回复）：</strong>
                        <a href="mailto:${senderEmail}" style="color: #4299e1; text-decoration: none;">${senderEmail}</a>
                    </p>
                    <p style="margin: 12px 0; color: #4a5568;">
                        <strong>留言提交时间：</strong>${new Date().toLocaleString()}
                    </p>
                    <p style="margin: 12px 0; color: #4a5568;">
                        <strong>留言内容：</strong>
                    </p>
                    <div style="background-color: #f5f7fa; padding: 16px; border-radius: 8px; margin: 10px 0; color: #2d3748; line-height: 1.6;">
                        ${content.replace(/\n/g, '<br>')} <!-- 换行符转HTML换行，保持格式 -->
                    </div>
                    <p style="margin: 12px 0; color: #718096; font-size: 14px;">
                        <strong>回复说明：</strong>直接回复此邮件，收件人会自动填充为用户的QQ邮箱，无需手动输入
                    </p>
                </div>
            `
        };

        // 4. 发送邮件（异步操作）
        await transporter.sendMail(mailOptions);
        console.log(`[${new Date().toLocaleString()}] 邮件发送成功：用户=${senderEmail}，目标邮箱=${targetEmail}`);

        // 5. 发送成功响应给前端
        res.json({
            success: true,
            message: '留言已成功发送到目标邮箱，我们会尽快回复你～'
        });

    } catch (error) {
        // 6. 捕获所有异常并返回友好提示
        console.error(`[${new Date().toLocaleString()}] 邮件发送失败：`, error.message);
        res.json({
            success: false,
            message: '邮件发送失败，请稍后重试（若多次失败，可检查QQ邮箱配置）'
        });
    }
});

// ---------------------- 全局错误处理中间件 ----------------------
app.use((err, req, res, next) => {
    console.error(`[${new Date().toLocaleString()}] 全局错误：`, err.stack);
    res.status(500).json({
        success: false,
        message: '服务器内部错误，请稍后重试'
    });
});

// ---------------------- 启动服务 ----------------------
app.listen(PORT, () => {
    console.log(`✅ 后端服务已启动成功！`);
    console.log(`📡 服务端口：${PORT}`);
    console.log(`🔍 测试接口：http://localhost:${PORT}/api/test`);
    console.log(`📧 留言接口：http://localhost:${PORT}/api/send-direct（POST方法）`);
    console.log(`⌛ 启动时间：${new Date().toLocaleString()}`);
}).on('error', (err) => {
    console.error(`❌ 服务启动失败：`, err.message);
    process.exit(1); // 启动失败时退出进程
});

// ---------------------- 捕获未处理的异常 ----------------------
// 防止进程因未捕获异常崩溃
process.on('uncaughtException', (err) => {
    console.error(`❌ 未处理异常：`, err.stack);
    process.exit(1);
});

// 防止Promise拒绝未处理导致的进程警告
process.on('unhandledRejection', (reason, promise) => {
    console.error(`❌ 未处理Promise拒绝：`, reason);
    process.exit(1);
});