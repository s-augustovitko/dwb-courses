export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type Role = "READER" | "WRITER" | "ADMIN";

export const roleMap: Record<Role, string> = {
  READER: "Lector",
  WRITER: "Editor",
  ADMIN: "Administrador",
};

export const roleOptions = (Object.keys(roleMap) as Role[]).map((item) => ({
  value: item,
  label: roleMap[item],
}));
