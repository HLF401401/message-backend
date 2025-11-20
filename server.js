// 加载环境变量（.env文件中的配置）
require('dotenv').config();

// 导入依赖
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

// 创建Express实例
const app = express();
const PORT = process.env.PORT || 3000; // 端口：优先使用环境变量，默认3000

// ---------------------- 中间件配置 ----------------------
// 1. 跨域配置：仅允许你的GitHub Pages域名访问（安全起见）
app.use(cors({
    origin: 'https://hlf401401.github.io', // 你的GitHub Pages域名
    methods: ['POST', 'GET'], // 允许的请求方法
    allowedHeaders: ['Content-Type'] // 允许的请求头
}));

// 2. 解析JSON请求体（前端传参用）
app.use(express.json({ limit: '1mb' })); // 限制请求体最大1MB

// ---------------------- 接口定义 ----------------------
/**
 * 测试接口：验证后端是否正常运行
 * 访问地址：https://你的后端地址/api/test
 */
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: '后端服务正常运行',
        timestamp: new Date().toLocaleString()
    });
});

/**
 * 核心接口：发送留言邮件
 * 请求方式：POST
 * 请求地址：https://你的后端地址/api/send-direct
 * 请求体：{ senderEmail: "用户QQ邮箱", content: "留言内容" }
 */
app.post('/api/send-direct', async (req, res) => {
    try {
        // 1. 获取前端传参
        const { senderEmail, content } = req.body;
        const targetEmail = process.env.TARGET_EMAIL; // 固定目标邮箱（从.env读取）

        // 2. 后端参数校验（防止前端绕过校验）
        if (!senderEmail || !content || !targetEmail) {
            return res.json({
                success: false,
                message: '参数不全，请填写QQ邮箱和留言内容'
            });
        }

        // 校验QQ邮箱格式（同前端正则）
        const qqEmailReg = /^[1-9]\d{4,10}@qq\.com$/;
        if (!qqEmailReg.test(senderEmail)) {
            return res.json({
                success: false,
                message: '无效的QQ邮箱格式'
            });
        }

        // 3. 配置QQ邮箱SMTP服务
        const transporter = nodemailer.createTransport({
            host: 'smtp.qq.com', // QQ邮箱SMTP服务器地址
            port: 465, // SSL加密端口
            secure: true, // 启用SSL加密（必须）
            auth: {
                user: process.env.QQ_EMAIL, // 你的QQ邮箱账号（SMTP认证用）
                pass: process.env.QQ_EMAIL_AUTH_CODE // 你的QQ邮箱授权码（不是QQ密码）
            },
            // 解决部分邮箱客户端显示"未知发件人"的问题
            tls: {
                rejectUnauthorized: false
            }
        });

        // 4. 构造邮件内容
        const mailOptions = {
            from: `"用户留言反馈" <${senderEmail}>`, // 显示发件人（用户QQ邮箱）
            to: targetEmail, // 固定目标邮箱（接收留言）
            subject: `【QQ邮箱留言】来自 ${senderEmail} 的反馈`, // 邮件主题
            // 文本格式正文（兼容所有邮箱客户端）
            text: `===== 留言详情 =====
发件人QQ邮箱：${senderEmail}
留言时间：${new Date().toLocaleString()}
留言内容：
${content}


===== 回复说明 =====
直接回复此邮件即可联系到留言用户`,
            // HTML格式正文（更美观，支持换行、加粗）
            html: `
                <h3>===== 留言详情 =====</h3>
                <p><strong>发件人QQ邮箱：</strong>${senderEmail}</p>
                <p><strong>留言时间：</strong>${new Date().toLocaleString()}</p>
                <p><strong>留言内容：</strong></p>
                <div style="background-color: #f5f7fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                    ${content.replace(/\n/g, '<br>')} <!-- 换行转HTML换行符 -->
                </div>
                <p><strong>回复说明：</strong>直接回复此邮件即可联系到留言用户</p>
            `
        };

        // 5. 发送邮件
        await transporter.sendMail(mailOptions);

        // 6. 发送成功，返回响应
        res.json({
            success: true,
            message: '留言邮件发送成功'
        });

    } catch (error) {
        // 7. 捕获错误，返回失败响应
        console.error('邮件发送失败：', error);
        res.json({
            success: false,
            message: '邮件发送失败，请稍后重试'
        });
    }
});

// ---------------------- 启动服务 ----------------------
app.listen(PORT, () => {
    console.log(`后端服务已启动，访问地址：http://localhost:${PORT}`);
    console.log(`测试接口：http://localhost:${PORT}/api/test`);
});
// 原错误配置（发件人是用户邮箱）
// from: `"用户反馈" <${senderEmail}>`

// 新配置（发件人改为你的QQ邮箱，与SMTP认证账号一致）
const mailOptions = {
    from: `"用户留言反馈" <${process.env.QQ_EMAIL}>`, // 改为你的QQ邮箱（认证账号）
    to: process.env.TARGET_EMAIL, // 你的目标邮箱（不变）
    subject: `【用户留言】来自 ${senderEmail}`, // 主题中显示用户邮箱，方便识别
    // 文本格式正文（清晰标注用户邮箱）
    text: `===== 留言详情 =====
用户QQ邮箱（可直接回复）：${senderEmail}
留言时间：${new Date().toLocaleString()}
留言内容：
${content}

===== 回复说明 =====
直接回复此邮件，收件人会自动填写为用户的QQ邮箱`,
    // HTML格式正文（更美观，支持换行）
    html: `
        <h3>===== 留言详情 =====</h3>
        <p><strong>用户QQ邮箱（可直接回复）：</strong>${senderEmail}</p>
        <p><strong>留言时间：</strong>${new Date().toLocaleString()}</p>
        <p><strong>留言内容：</strong></p>
        <div style="background-color: #f5f7fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
            ${content.replace(/\n/g, '<br>')}
        </div>
        <p><strong>回复说明：</strong>直接回复此邮件，即可联系到留言用户</p>
    `
};