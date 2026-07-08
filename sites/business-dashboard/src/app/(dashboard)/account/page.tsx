"use client";
import type { DeleteAccountProof, SessionInfo } from "@repo/api-client";
import { DeleteAccountModal } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Pencil, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleReauthLogin } from "@/components/GoogleReauthLogin";
import {
	Button,
	Card,
	Field,
	inputClass,
	PageHeader,
	ScreenSkeleton,
} from "@/components/primitives";
import { useToast } from "@/context/toast";
import { useCurrentUser } from "@/hooks/useOwnerData";
import { api, tokenStore } from "@/lib/api";
import { cn } from "@/lib/cn";

export default function AccountPage() {
	const router = useRouter();
	const qc = useQueryClient();
	const { flash } = useToast();
	const userQuery = useCurrentUser();
	const user = userQuery.data;

	const [editName, setEditName] = useState("");
	const [editing, setEditing] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);

	const sessionsQuery = useQuery({
		queryKey: ["auth", "sessions"],
		queryFn: () => api.auth.listSessions(),
		staleTime: 60_000,
	});
	const sessions: SessionInfo[] =
		(sessionsQuery.data as SessionInfo[] | undefined) ?? [];

	const revokeMut = useMutation({
		mutationFn: (id: string) => api.auth.revokeSession(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
			flash("Session revoked", "Shield");
		},
	});

	const deleteAccountMut = useMutation({
		mutationFn: (proof: DeleteAccountProof) => {
			if (!user?.id) throw new Error("Not signed in");
			return api.users.delete(user.id, proof);
		},
		onSuccess: () => handleLogout(),
		onError: (e: Error) => setDeleteError(e.message),
	});

	const updateMut = useMutation({
		// biome-ignore lint/style/noNonNullAssertion: mutation only fires when user is authenticated
		mutationFn: (name: string) => api.users.update(user!.id, { name }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["auth", "me"] });
			setEditing(false);
			flash("Profile updated", "User");
		},
		onError: (e: Error) => flash(e.message),
	});

	async function handleLogout() {
		try {
			await api.auth.logout();
		} catch {
			/* ignore */
		}
		tokenStore.clearTokens();
		router.replace("/login");
	}

	function startEdit() {
		setEditName(user?.name ?? "");
		setEditing(true);
	}

	if (userQuery.isLoading) return <ScreenSkeleton rows={2} cards={2} />;

	const authMethods = user?.authMethods ?? { password: false, google: false };

	return (
		<div>
			<PageHeader
				eyebrow="Account"
				title="Profile & settings"
				sub="Manage your personal information and active sessions."
			/>

			{/* Profile card */}
			<Card className="mb-6" padding="none">
				<div className="p-6 flex items-start gap-5">
					<div className="w-16 h-16 rounded-full bg-primary-900 flex items-center justify-center shrink-0">
						<User size={28} className="text-white" />
					</div>
					<div className="flex-1 min-w-0">
						{editing ? (
							<div className="flex items-end gap-3 flex-wrap">
								<div className="flex-1 min-w-0">
									<Field label="Name">
										<input
											value={editName}
											onChange={(e) => setEditName(e.target.value)}
											className={cn(inputClass, "max-w-xs")}
										/>
									</Field>
								</div>
								<div className="flex gap-2 pb-0.5">
									<Button variant="ghost" onClick={() => setEditing(false)}>
										Cancel
									</Button>
									<Button
										disabled={!editName.trim() || updateMut.isPending}
										onClick={() =>
											editName.trim() && updateMut.mutate(editName.trim())
										}
									>
										{updateMut.isPending ? "Saving…" : "Save"}
									</Button>
								</div>
							</div>
						) : (
							<>
								<div className="font-serif text-2xl font-medium text-ink-900 truncate">
									{user?.name}
								</div>
								{user?.email && (
									<div className="font-sans text-sm text-ink-500 mt-1">
										{user.email}
									</div>
								)}
								<button
									type="button"
									onClick={startEdit}
									className="mt-3 flex items-center gap-1.5 font-sans text-sm font-medium text-primary-700 bg-transparent border-none cursor-pointer p-0"
								>
									<Pencil size={14} />
									Edit name
								</button>
							</>
						)}
					</div>
				</div>
			</Card>

			{/* Sessions */}
			{sessions.length > 0 && (
				<Card className="mb-6" padding="none">
					<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
						<Shield size={17} className="text-primary-700" />
						<h2 className="m-0 font-serif font-medium text-lg text-ink-900">
							Active sessions
						</h2>
					</div>
					<div>
						{sessions.map((s, i) => (
							<div
								key={s.id}
								className={[
									"px-6 py-3.5 flex items-center justify-between gap-4",
									i ? "border-t border-line-soft" : "",
								].join(" ")}
							>
								<div>
									<div className="font-sans text-sm text-ink-700 truncate max-w-xs">
										{s.deviceName ?? s.deviceId ?? "Unknown device"}
									</div>
									<div className="font-sans text-xs text-ink-400 mt-0.5">
										Last used{" "}
										{new Date(s.lastUsedAt).toLocaleDateString("en-BD", {
											dateStyle: "medium",
										})}
									</div>
								</div>
								<button
									type="button"
									onClick={() => revokeMut.mutate(s.id)}
									disabled={revokeMut.isPending}
									className="font-sans text-xs font-medium text-danger-fg bg-danger-bg border border-danger-fg/20 rounded-md px-2.5 py-1 cursor-pointer hover:bg-danger-fg/10 disabled:opacity-50"
								>
									Revoke
								</button>
							</div>
						))}
					</div>
				</Card>
			)}

			{/* Sign out */}
			<div className="flex justify-start">
				<button
					type="button"
					onClick={handleLogout}
					className="flex items-center gap-2 font-sans text-sm font-medium text-danger-fg bg-transparent border-none cursor-pointer p-0 hover:underline"
				>
					<LogOut size={15} />
					Sign out of all devices
				</button>
			</div>

			{/* Danger zone */}
			<Card className="mt-8 border-danger-fg/20">
				<h3 className="m-0 text-base font-bold text-danger-fg mb-1">
					Danger zone
				</h3>
				<p className="mt-1 mb-4 text-sm text-ink-500">
					Permanently deletes your account and all associated data. This cannot
					be undone.
				</p>
				<Button
					variant="danger"
					icon="Trash2"
					disabled={deleteAccountMut.isPending || !user}
					onClick={() => {
						setDeleteError(null);
						setGoogleIdToken(null);
						setDeleteOpen(true);
					}}
				>
					Delete account
				</Button>
			</Card>

			<DeleteAccountModal
				open={deleteOpen}
				authMethods={authMethods}
				googleIdToken={googleIdToken}
				isPending={deleteAccountMut.isPending}
				error={deleteError}
				onClose={() => {
					if (deleteAccountMut.isPending) return;
					setDeleteOpen(false);
					setDeleteError(null);
					setGoogleIdToken(null);
				}}
				onDelete={async (proof) => {
					setDeleteError(null);
					await deleteAccountMut.mutateAsync(proof);
				}}
				googleVerify={
					<GoogleReauthLogin
						disabled={!authMethods.google}
						onCredential={(token) => {
							setGoogleIdToken(token);
							setDeleteError(null);
						}}
					/>
				}
			/>
		</div>
	);
}
