"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/session";

const ROLE_OPTIONS = ["admin", "product_editor", "product_approver", "ops", "readonly"];

export default function UsersPage() {
  const { api } = useSession();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleCodes, setRoleCodes] = useState<string[]>(["readonly"]);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.listUsers(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createUser({ email, name, password, roleCodes }),
    onSuccess: () => {
      pushToast("User created", "success");
      setEmail("");
      setName("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const unlockMutation = useMutation({
    mutationFn: (userId: string) => api.unlockUser(userId),
    onSuccess: () => {
      pushToast("Account unlocked", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  if (usersQuery.isLoading) return <LoadingState />;
  if (usersQuery.error) return <ErrorState message={(usersQuery.error as Error).message} />;

  const items = usersQuery.data?.items ?? [];

  return (
    <div>
      <PageHeader title="Users" description="Manage admin users and role assignments." />

      <div className="card mb-6 space-y-3 p-5">
        <h2 className="font-medium">Create user</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input md:col-span-2"
            type="password"
            placeholder="Password (12+ chars, mixed classes)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={roleCodes.includes(role)}
                onChange={(e) =>
                  setRoleCodes((current) =>
                    e.target.checked ? [...current, role] : current.filter((code) => code !== role),
                  )
                }
              />
              {role}
            </label>
          ))}
        </div>
        <button className="btn-primary" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
          Create user
        </button>
      </div>

      <DataTable
        data={items}
        columns={[
          { header: "Email", accessorKey: "email" },
          { header: "Name", accessorKey: "name" },
          {
            header: "Roles",
            cell: ({ row }) => ((row.original.roles as string[]) ?? []).join(", "),
          },
          {
            header: "Status",
            cell: ({ row }) => {
              const lockedUntil = row.original.lockedUntil as string | null;
              return lockedUntil ? `Locked until ${new Date(lockedUntil).toLocaleString()}` : "Active";
            },
          },
          {
            header: "Actions",
            cell: ({ row }) =>
              row.original.lockedUntil ? (
                <button
                  className="btn-secondary"
                  onClick={() => unlockMutation.mutate(row.original.id as string)}
                >
                  Unlock
                </button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
