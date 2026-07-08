"use client";
import type { Branch as ApiBranch } from "@repo/api-client";
import { useQueryClient } from "@tanstack/react-query";
import type { Service } from "@/components/data";
import { ServicesScreen } from "@/components/screens/ServicesScreen";
import { useToast } from "@/context/toast";
import {
	useAllBranchServices,
	useBranches,
	useCreateService,
	useDeleteServicePhoto,
	useMyBusiness,
	useUpdateService,
	useUploadServicePhoto,
} from "@/hooks/useOwnerData";
import { adaptService } from "@/lib/adapters";
import { api } from "@/lib/api";

export default function ServicesPage() {
	const { flash } = useToast();
	const qc = useQueryClient();

	const businessQuery = useMyBusiness();
	const businessId = businessQuery.data?.id ?? null;
	const branchesQuery = useBranches(businessId);
	const apiBranches = (branchesQuery.data?.data ?? []) as ApiBranch[];
	const { services: apiServices } = useAllBranchServices(
		apiBranches.map((b) => b.id),
	);
	const services = apiServices.map((s) =>
		adaptService(s as never, apiBranches),
	);

	const createServiceMut = useCreateService();
	const updateServiceMut = useUpdateService();
	const uploadPhotoMut = useUploadServicePhoto();
	const deletePhotoMut = useDeleteServicePhoto();

	function addService(s: Service) {
		const branchId =
			apiBranches.find((b) => b.name === s.branch)?.id ??
			apiBranches[0]?.id ??
			null;
		if (!branchId) {
			flash("No branch found");
			return;
		}
		createServiceMut.mutate(
			{
				branchId,
				name: s.name,
				category: s.category,
				duration: s.duration,
				price: s.price,
				description: s.desc,
			},
			{
				onSuccess: () => flash("Service added", "Sparkles"),
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function removeService(id: string) {
		api.services
			.delete(id)
			.then(() => {
				qc.invalidateQueries({ queryKey: ["services"] });
				flash("Service removed");
			})
			.catch((e: Error) => flash(e.message));
	}

	function updateService(
		id: string,
		body: Partial<
			Pick<Service, "name" | "category" | "duration" | "price" | "desc">
		>,
	) {
		updateServiceMut.mutate(
			{
				id,
				body: {
					name: body.name,
					category: body.category,
					duration: body.duration,
					price: body.price,
					description: body.desc,
				},
			},
			{
				onSuccess: () => flash("Service updated", "Sparkles"),
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function uploadPhoto(id: string, file: File) {
		uploadPhotoMut.mutate(
			{ id, file },
			{
				onSuccess: () => flash("Photo uploaded", "Image"),
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function deletePhoto(id: string) {
		deletePhotoMut.mutate(id, {
			onSuccess: () => flash("Photo removed"),
			onError: (e: Error) => flash(e.message),
		});
	}

	return (
		<ServicesScreen
			services={services}
			branches={apiBranches.map((b) => b.name)}
			onAdd={addService}
			onRemove={removeService}
			onUpdate={updateService}
			onUploadPhoto={uploadPhoto}
			onDeletePhoto={deletePhoto}
		/>
	);
}
