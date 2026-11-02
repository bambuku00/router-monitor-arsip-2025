"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { login } from "@/lib/server-actions/auth-actions";
import { resolvePostLoginPath } from "@/lib/staff-menu-access";
import { FormEvent, useState } from "react";

export default function FormLoginPetugas() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const post = await login(
        { user: username, password },
        { onlyPetugas: true }
      );
      if (post.error) throw post.error;
      if (!post.user) throw new Error("Terjadi kesalahan pada server");
      const target = resolvePostLoginPath({
        role: post.user.role,
        id: post.user.id,
        parentId: post.user.parentId ?? null,
        staffMenuKeys: post.user.staffMenuKeys,
      });
      window.location.assign(target);
    } catch (err) {
      setError(
        typeof err === "string" && err.trim()
          ? err
          : "Terjadi kesalahan pada server"
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <label className="grid gap-2 text-base text-slate-700 dark:text-theme-fg">
        Username
        <Input
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="h-14 bg-slate-100 px-4 text-base dark:bg-theme-elevated"
        />
      </label>
      <label className="grid gap-2 text-base text-slate-700 dark:text-theme-fg">
        Password
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-14 bg-slate-100 px-4 text-base dark:bg-theme-elevated"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <div className="pt-4">
        <Button
          type="submit"
          color="red"
          className="h-14 w-full justify-center bg-red-500 text-base"
          loading={pending}
        >
          Masuk
        </Button>
      </div>
    </form>
  );
}
