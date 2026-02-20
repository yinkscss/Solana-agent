"use client";

import { PolicyList } from "@/components/policies/policy-list";
import { CreatePolicyDialog } from "@/components/policies/create-policy-dialog";

export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-muted-foreground">
            Manage transaction policies and rules
          </p>
        </div>
        <CreatePolicyDialog />
      </div>
      <PolicyList />
    </div>
  );
}
