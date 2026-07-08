export type SendEmailFn = (message: {
	from: string;
	to: string;
	subject: string;
	text: string;
}) => Promise<unknown>;

export class PasswordEmail {
	constructor(
		private readonly sendEmail: SendEmailFn | undefined,
		private readonly from: string | undefined,
		private readonly logResetLink: boolean,
	) {}

	async sendResetEmail(
		to: string,
		name: string,
		resetUrl: string,
	): Promise<void> {
		const subject = "Reset your Talash password";
		const text = [
			`Hi ${name},`,
			"",
			"We received a request to reset your password. Tap the link below — it expires in 1 hour.",
			"",
			resetUrl,
			"",
			"If you didn't request this, ignore this email.",
		].join("\n");

		if (this.logResetLink || !this.sendEmail || !this.from) {
			console.log(`[auth] Password reset link for ${to}: ${resetUrl}`);
			if (!this.sendEmail || !this.from) return;
		}

		await this.sendEmail({ from: this.from, to, subject, text });
	}
}
