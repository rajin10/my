import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useRewardsBalance() {
	return useQuery({
		queryKey: ["rewards", "balance"],
		queryFn: () => api.rewards.balance(),
		staleTime: 30_000,
	});
}

export function useRewardsHistory(params?: { page?: number; limit?: number }) {
	return useQuery({
		queryKey: params ? ["rewards", "history", params] : ["rewards", "history"],
		queryFn: () => api.rewards.history(params),
		staleTime: 30_000,
	});
}

export function useRedeemRewards() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (points: number) => api.rewards.redeem({ points }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["rewards", "balance"] });
			qc.invalidateQueries({ queryKey: ["rewards", "history"] });
		},
	});
}
