"use client";
import type { Branch as ApiBranch, BusinessPhoto } from "@repo/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Branch } from "@/components/data";
import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { useToast } from "@/context/toast";
import {
	useBranches,
	useDeleteBranch,
	useDeleteBusiness,
	useMyBusiness,
	useReorderBusinessPhotos,
	useUpdateBranch,
	useUploadBusinessPhoto,
	useBusinessPhotos,
} from "@/hooks/useOwnerData";
import { api } from "@/lib/api";

export default function SettingsPage() {
	const { flash } = useToast();
	const qc = useQueryClient();
	const [savingProfile, setSavingProfile] = useState(false);

	const businessQuery = useMyBusiness();
	const businessId = businessQuery.data?.id ?? null;
	const branchesQuery = useBranches(businessId);
	const apiBranches = (branchesQuery.data?.data ?? []) as ApiBranch[];
	const branches: Branch[] = apiBranches.map((b, i) => ({
		id: b.id,
		name: b.name,
		address: b.address,
		city: b.city,
		phone: "",
		services: 0,
		staff: 0,
		isMain: i === 0,
	}));

	const photosQuery = useBusinessPhotos(businessId);
	const photos: BusinessPhoto[] = photosQuery.data ?? [];

	const updateBranchMut = useUpdateBranch();
	const deleteBranchMut = useDeleteBranch();
	const uploadPhotoMut = useUploadBusinessPhoto();
	const reorderPhotoMut = useReorderBusinessPhotos();
	const deleteBusinessMut = useDeleteBusiness();

	function handleStatus(s: string) {
		if (!businessId) return;
		api.businesses
			.update(businessId, { status: s as never })
			.then(() => {
				qc.invalidateQueries({ queryKey: ["business", "owner"] });
				flash(`Business set to ${s}`, s === "Active" ? "CheckCircle" : "PenLine");
			})
			.catch((e: Error) => flash(e.message));
	}

	function saveProfile(
		name: string,
		category: string,
		description: string,
		phone: string,
		email: string,
		website: string,
	) {
		if (!businessId) return;
		setSavingProfile(true);
		api.businesses
			.update(businessId, {
				name,
				category,
				description,
				phone: phone || null,
				email: email || null,
				website: website || null,
			} as never)
			.then(() => {
				qc.invalidateQueries({ queryKey: ["business", "owner"] });
				flash("Profile saved", "Check");
			})
			.catch((e: Error) => flash(e.message))
			.finally(() => setSavingProfile(false));
	}

	function addBranch(b: Branch) {
		if (!businessId) return;
		api.branches
			.create({ businessId, name: b.name, address: b.address, city: b.city })
			.then(() => {
				qc.invalidateQueries({ queryKey: ["branches"] });
				flash("Branch added", "MapPin");
			})
			.catch((e: Error) => flash(e.message));
	}

	function editBranch(
		id: string,
		body: Partial<Pick<Branch, "name" | "address" | "city" | "phone">>,
	) {
		updateBranchMut.mutate(
			{ id, body: { name: body.name, address: body.address, city: body.city } },
			{
				onSuccess: () => flash("Branch updated", "MapPin"),
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function deleteBranch(id: string) {
		deleteBranchMut.mutate(id, {
			onSuccess: () => flash("Branch removed"),
			onError: (e: Error) => flash(e.message),
		});
	}

	function uploadPhoto(file: File) {
		if (!businessId) return;
		uploadPhotoMut.mutate(
			{ id: businessId, file },
			{
				onSuccess: () => flash("Photo uploaded", "Image"),
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function deletePhoto(photoId: string) {
		if (!businessId) return;
		api.businesses
			.deletePhoto(businessId, photoId)
			.then(() => {
				qc.invalidateQueries({ queryKey: ["business-photos", businessId] });
				flash("Photo deleted");
			})
			.catch((e: Error) => flash(e.message));
	}

	function reorderPhoto(photoId: string, direction: -1 | 1) {
		if (!businessId) return;
		const idx = photos.findIndex((p) => p.id === photoId);
		if (idx < 0) return;
		const swapIdx = idx + direction;
		if (swapIdx < 0 || swapIdx >= photos.length) return;
		const reordered = [...photos];

		[reordered[idx], reordered[swapIdx]] = [
			reordered[swapIdx]!,
			reordered[idx]!,
		];
		const orders = reordered.map((p, i) => ({ id: p.id, order: i }));
		reorderPhotoMut.mutate(
			{ businessId, orders },
			{ onError: (e: Error) => flash(e.message) },
		);
	}

	function deleteBusiness() {
		if (!businessId) return;
		if (
			!window.confirm(
				"Archive this business? It will be removed from customer search. You can restore it from this page.",
			)
		)
			return;
		deleteBusinessMut.mutate(businessId, {
			onSuccess: () => flash("Business archived", "Archive"),
			onError: (e: Error) => flash(e.message),
		});
	}

	return (
		<SettingsScreen
			status={businessQuery.data?.status ?? "Draft"}
			onStatus={handleStatus}
			branches={branches}
			onAddBranch={addBranch}
			onEditBranch={editBranch}
			onDeleteBranch={deleteBranch}
			onUploadPhoto={uploadPhoto}
			onDeletePhoto={deletePhoto}
			onReorderPhoto={reorderPhoto}
			photos={photos}
			onSaveProfile={saveProfile}
			savingProfile={savingProfile}
			businessName={businessQuery.data?.name}
			businessCategory={businessQuery.data?.category}
			businessDescription={businessQuery.data?.description ?? undefined}
			businessPhone={businessQuery.data?.phone ?? undefined}
			businessEmail={businessQuery.data?.email ?? undefined}
			businessWebsite={businessQuery.data?.website ?? undefined}
			onDeleteBusiness={deleteBusiness}
		/>
	);
}
