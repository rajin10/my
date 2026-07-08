"use client";
import type { DeleteAccountProof, User } from "@repo/api-client";
import { DeleteAccountModal } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, LogOut, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { GoogleReauthLogin } from "@/components/GoogleReauthLogin";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function ProfileCard() {
	const qc = useQueryClient();
	const { user, signOut } = useAuth();
	const [editingName, setEditingName] = useState(false);
	const [editName, setEditName] = useState("");
	const [editingPhone, setEditingPhone] = useState(false);
	const [editPhone, setEditPhone] = useState("");
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);

	const userId = user?.id;

	// Full record (phone + createdAt) — auth.me()/AuthUser only has id/email/name/role.
	const { data: detail } = useQuery({
		queryKey: ["user", "me", userId],
		// biome-ignore lint/style/noNonNullAssertion: enabled only when userId is set
		queryFn: () => api.users.get(userId!),
		enabled: !!userId,
		staleTime: 60_000,
	});
	const fullUser: User | undefined = detail?.data;

	const updateNameMut = useMutation({
		// biome-ignore lint/style/noNonNullAssertion: only invoked from authenticated UI
		mutationFn: (name: string) => api.users.update(userId!, { name }),
		onSuccess: (_d, name) => {
			if (user) useAuthStore.getState().setUser({ ...user, name });
			qc.invalidateQueries({ queryKey: ["user", "me", userId] });
			setEditingName(false);
		},
	});

	const updatePhoneMut = useMutation({
		// biome-ignore lint/style/noNonNullAssertion: only invoked from authenticated UI
		mutationFn: (phone: string) => api.users.update(userId!, { phone }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["user", "me", userId] });
			setEditingPhone(false);
		},
	});

	const uploadPhotoMut = useMutation({
		mutationFn: (file: File) => {
			const fd = new FormData();
			fd.append("file", file);
			// biome-ignore lint/style/noNonNullAssertion: only invoked from authenticated UI
			return api.users.uploadPhoto(userId!, fd);
		},
		onSuccess: (res) => {
			if (user) useAuthStore.getState().setUser({ ...user, photoUrl: res.url });
			qc.invalidateQueries({ queryKey: ["user", "me", userId] });
		},
	});

	const deleteAccountMut = useMutation({
		// biome-ignore lint/style/noNonNullAssertion: only invoked from authenticated UI
		mutationFn: (proof: DeleteAccountProof) => api.users.delete(userId!, proof),
		onSuccess: async () => {
			try {
				await api.auth.logout();
			} catch {
				/* ignore */
			}
			useAuthStore.getState().signOut();
			qc.clear();
			if (typeof window !== "undefined") window.location.href = "/";
		},
		onError: (e: Error) => setDeleteError(e.message),
	});

	if (!user) return null;

	const authMethods = user.authMethods ?? { password: false, google: false };

	const memberSince = fullUser?.createdAt
		? new Date(fullUser.createdAt).toLocaleDateString("en-BD", {
				month: "long",
				year: "numeric",
			})
		: null;

	return (
		<>
			<div className="bg-surface rounded-xl border border-line p-6 md:p-8 mb-6 flex items-start justify-between gap-4">
				<div className="flex items-center gap-4">
					<label className="relative w-14 h-14 rounded-full overflow-hidden bg-primary-900 flex items-center justify-center shrink-0 cursor-pointer group">
						{fullUser?.photoUrl ? (
							// plain <img>: remote R2 URL (next/image is not used for remote URLs here)
							<img
								src={fullUser.photoUrl}
								alt={user.name}
								className="w-full h-full object-cover"
							/>
						) : (
							<span className="font-serif text-2xl font-medium text-white">
								{user.name.charAt(0).toUpperCase()}
							</span>
						)}
						<span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
							<Camera size={16} className="text-white" />
						</span>
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp"
							className="hidden"
							disabled={uploadPhotoMut.isPending}
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) uploadPhotoMut.mutate(file);
								e.target.value = "";
							}}
						/>
					</label>
					<div>
						{editingName ? (
							<form
								onSubmit={(e) => {
									e.preventDefault();
									if (editName.trim()) updateNameMut.mutate(editName.trim());
								}}
								className="flex items-center gap-2"
							>
								<input
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									className="font-serif text-xl border-b border-primary-500 outline-none bg-transparent text-ink-900 w-48"
								/>
								<button
									type="submit"
									disabled={updateNameMut.isPending}
									className="text-primary-700 bg-transparent border-none cursor-pointer p-0"
								>
									<Check size={17} />
								</button>
								<button
									type="button"
									onClick={() => setEditingName(false)}
									className="text-ink-400 bg-transparent border-none cursor-pointer p-0"
								>
									<X size={17} />
								</button>
							</form>
						) : (
							<div className="flex items-center gap-2">
								<div className="font-serif text-2xl font-medium text-ink-900">
									{user.name}
								</div>
								<button
									type="button"
									onClick={() => {
										setEditName(user.name);
										setEditingName(true);
									}}
									className="text-ink-400 hover:text-ink-700 bg-transparent border-none cursor-pointer p-0"
									aria-label="Edit name"
								>
									<Pencil size={14} />
								</button>
							</div>
						)}
						{user.email && (
							<div className="font-sans text-sm text-ink-500 mt-0.5">
								{user.email}
							</div>
						)}

						{/* Phone (new) */}
						{editingPhone ? (
							<form
								onSubmit={(e) => {
									e.preventDefault();
									updatePhoneMut.mutate(editPhone.trim());
								}}
								className="flex items-center gap-2 mt-1"
							>
								<input
									value={editPhone}
									onChange={(e) => setEditPhone(e.target.value)}
									placeholder="01XXXXXXXXX"
									className="font-sans text-sm border-b border-primary-500 outline-none bg-transparent text-ink-900 w-40"
								/>
								<button
									type="submit"
									disabled={updatePhoneMut.isPending}
									className="text-primary-700 bg-transparent border-none cursor-pointer p-0"
								>
									<Check size={15} />
								</button>
								<button
									type="button"
									onClick={() => setEditingPhone(false)}
									className="text-ink-400 bg-transparent border-none cursor-pointer p-0"
								>
									<X size={15} />
								</button>
							</form>
						) : (
							<div className="flex items-center gap-2 mt-1">
								<span className="font-sans text-sm text-ink-500">
									{fullUser?.phone ?? "Add phone"}
								</span>
								<button
									type="button"
									onClick={() => {
										setEditPhone(fullUser?.phone ?? "");
										setEditingPhone(true);
									}}
									className="text-ink-400 hover:text-ink-700 bg-transparent border-none cursor-pointer p-0"
									aria-label="Edit phone"
								>
									<Pencil size={12} />
								</button>
							</div>
						)}
						{updatePhoneMut.isError && (
							<p className="font-sans text-xs text-danger-fg mt-1 m-0">
								{(updatePhoneMut.error as Error).message}
							</p>
						)}
						{uploadPhotoMut.isError && (
							<p className="font-sans text-xs text-danger-fg mt-1 m-0">
								{(uploadPhotoMut.error as Error).message}
							</p>
						)}

						{/* Member since (new) */}
						{memberSince && (
							<div className="font-sans text-xs text-ink-400 mt-1.5">
								Member since {memberSince}
							</div>
						)}
					</div>
				</div>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={() => {
							signOut();
						}}
						className="flex items-center gap-1.5 font-sans text-sm font-medium text-ink-500 hover:text-ink-900 bg-transparent border-none cursor-pointer p-0"
					>
						<LogOut size={16} />
						Sign out
					</button>
					<button
						type="button"
						disabled={deleteAccountMut.isPending}
						onClick={() => {
							setDeleteError(null);
							setGoogleIdToken(null);
							setDeleteOpen(true);
						}}
						className="flex items-center gap-1.5 font-sans text-xs font-medium text-danger-fg hover:opacity-70 bg-transparent border-none cursor-pointer p-0 disabled:opacity-50"
					>
						<Trash2 size={13} />
						Delete account
					</button>
				</div>
			</div>

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
		</>
	);
}
