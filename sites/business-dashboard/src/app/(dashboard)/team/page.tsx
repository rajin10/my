"use client";
import type {
	AddTeamMemberBody,
	Branch as ApiBranch,
	TeamMember as ApiTeamMember,
	TeamRole,
} from "@repo/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ScreenSkeleton } from "@/components/primitives";
import { TeamScreen } from "@/components/screens/TeamScreen";
import { useToast } from "@/context/toast";
import {
	useAddTeamMember,
	useBranches,
	useMyBusiness,
	useTeam,
	useUpdateTeamMember,
} from "@/hooks/useOwnerData";
import { adaptTeamMember } from "@/lib/adapters";
import { api } from "@/lib/api";

export default function TeamPage() {
	const { flash } = useToast();
	const qc = useQueryClient();

	const businessQuery = useMyBusiness();
	const businessId = businessQuery.data?.id ?? null;
	const branchesQuery = useBranches(businessId);
	const apiBranches = (branchesQuery.data?.data ?? []) as ApiBranch[];
	const teamQuery = useTeam(businessId);
	const team = (teamQuery.data?.data ?? []).map((m) =>
		adaptTeamMember(m as ApiTeamMember, apiBranches),
	);

	const addMut = useAddTeamMember();
	const updateMut = useUpdateTeamMember();

	function addTeamMember(body: AddTeamMemberBody) {
		addMut.mutate(body, {
			onSuccess: () => flash("Staff member added", "UserPlus"),
			onError: (e: Error) => flash(e.message),
		});
	}

	function updateTeamMember(
		id: string,
		body: { role?: Exclude<TeamRole, "Owner">; title?: string },
	) {
		updateMut.mutate(
			{ id, body },
			{
				onSuccess: () => flash("Team member updated", "User"),
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function removeTeamMember(id: string) {
		api.team
			.remove(id)
			.then(() => {
				qc.invalidateQueries({ queryKey: ["team"] });
				flash("Staff member removed");
			})
			.catch((e: Error) => flash(e.message));
	}

	if (businessQuery.isLoading) {
		return <ScreenSkeleton rows={2} cards={0} />;
	}

	return (
		<TeamScreen
			team={team}
			apiBranches={apiBranches}
			businessId={businessId}
			onAdd={addTeamMember}
			onUpdate={updateTeamMember}
			onRemove={removeTeamMember}
		/>
	);
}
