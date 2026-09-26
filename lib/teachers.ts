import { supabase } from "@/lib/supabase/client";

export type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  subject: string | null;
  is_active: boolean;
  created_at: string;
};

export async function getTeachers() {
  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data as Teacher[];
}
