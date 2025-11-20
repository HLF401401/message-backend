/**
 * 核心接口：发送留言邮件
 * 请求方式：POST
 * 请求地址：https://你的后端地址/api/send-direct
 * 请求体：{ senderEmail: "用户QQ邮箱", content: "留言内容" }
 */
app.post('/api/send-direct', async (req, res) => {
    try {
        // 1. 获取前端传参（senderEmail 在这里定义，属于接口回调函数的局部变量）
        const { senderEmail, content } = req.body; // 关键：senderEmail 仅在这个函数内有效
        const targetEmail = process.env.TARGET_EMAIL;
        const authEmail = process.env.QQ_EMAIL; // 你的QQ邮箱（SMTP认证账号）

        // 2. 后端参数校验（必须保留，防止无效参数）
        if (!senderEmail || !content || !targetEmail || !authEmail) {
            return res.json({
                success: false,
                message: '参数不全，请填写QQ邮箱和留言内容'
            });
        }

        // 校验QQ邮箱格式
        const qqEmailReg = /^[1-9]\d{4,10}@qq\.com$/;
        if (!qqEmailReg.test(senderEmail)) {
            return res.json({
                success: false,
                message: '无效的QQ邮箱格式'
            });
        }

        // 3. 配置QQ邮箱SMTP服务（不变）
        const transporter = nodemailer.createTransport({
            host: 'smtp.qq.com',
            port: 465,
            secure: true,
            auth: {
                user: authEmail, // 用你的QQ邮箱认证（与发件人一致）
                pass: process.env.QQ_EMAIL_AUTH_CODE
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // 4. 构造邮件内容（关键：senderEmail 在这里使用，必须在函数内）
        const mailOptions = {
            from: `"用户留言反馈" <${authEmail}>`, // 发件人：你的QQ邮箱（与认证账号一致）
            to: targetEmail, // 你的目标邮箱
            subject: `【用户留言】来自 ${senderEmail}`, // 主题中显示用户邮箱
            text: `===== 留言详情 =====
用户QQ邮箱（可直接回复）：${senderEmail}
留言时间：${new Date().toLocaleString()}
留言内容：
${content}

===== 回复说明 =====
直接回复此邮件，收件人会自动填写为用户的QQ邮箱`,
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

        // 5. 发送邮件
        await transporter.sendMail(mailOptions);

        // 6. 返回成功响应
        res.json({
            success: true,
            message: '留言邮件发送成功'
        });

    } catch (error) {
        // 7. 捕获错误
        console.error('邮件发送失败：', error);
        res.json({
            success: false,
            message: '邮件发送失败，请稍后重试'
        });
    }
});