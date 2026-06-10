import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { rc } from "@/lib/rc-client";

/** All configured remotes with their config (type, parameters). */
export function useRemotes() {
  return useQuery({
    queryKey: ["remotes"],
    queryFn: () => rc.configDump(),
  });
}

export function useCreateRemote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      type,
      parameters,
      interactive,
    }: {
      name: string;
      type: string;
      parameters: Record<string, unknown>;
      interactive?: boolean;
    }) => rc.createRemote(name, type, parameters, { interactive }),
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["remotes"] });
      toast.success(`Remote "${vars.name}" created`);
    },
    onError: (err) => toast.error(`Failed to create remote: ${err.message}`),
  });
}

export function useUpdateRemote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, parameters }: { name: string; parameters: Record<string, unknown> }) =>
      rc.updateRemote(name, parameters),
    onSuccess: (_d, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["remotes"] });
      toast.success(`Remote "${vars.name}" updated`);
    },
    onError: (err) => toast.error(`Failed to update remote: ${err.message}`),
  });
}

export function useDeleteRemote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => rc.deleteRemote(name),
    onSuccess: (_d, name) => {
      void queryClient.invalidateQueries({ queryKey: ["remotes"] });
      toast.success(`Remote "${name}" deleted`);
    },
    onError: (err) => toast.error(`Failed to delete remote: ${err.message}`),
  });
}

/** Probe a remote by listing its root. */
export function useTestRemote() {
  return useMutation({
    mutationFn: (name: string) => rc.list(`${name}:`, ""),
    onSuccess: (_d, name) => toast.success(`Connection to "${name}" works`),
    onError: (err, name) => toast.error(`Connection to "${name}" failed: ${err.message}`),
  });
}
