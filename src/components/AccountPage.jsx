import { useEffect, useMemo, useState } from "react";
import { Camera, LogIn, LogOut, Save, UserRound } from "lucide-react";
import {
  autonomousCommunities,
  provincesForCommunity,
  townsForProvince,
} from "../lib/spanishLocations";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

function AccountPage({ session, onSessionChange, onNotice }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [community, setCommunity] = useState("");
  const [province, setProvince] = useState("");
  const [locality, setLocality] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const provinces = useMemo(
    () => provincesForCommunity(community),
    [community],
  );
  const towns = useMemo(() => townsForProvince(province), [province]);

  function LocationFields() {
    return (
      <>
        <label>
          Comunidad autonoma
          <select
            value={community}
            onChange={(event) => {
              setCommunity(event.target.value);
              setProvince("");
              setLocality("");
            }}
            required
          >
            <option value="">Selecciona una comunidad</option>
            {autonomousCommunities.map((communityName) => (
              <option key={communityName} value={communityName}>
                {communityName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Provincia
          <select
            value={province}
            onChange={(event) => {
              setProvince(event.target.value);
              setLocality("");
            }}
            disabled={!community}
            required
          >
            <option value="">Selecciona una provincia</option>
            {provinces.map((provinceName) => (
              <option key={provinceName} value={provinceName}>
                {provinceName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Poblacion
          <select
            value={locality}
            onChange={(event) => setLocality(event.target.value)}
            disabled={!province}
            required
          >
            <option value="">Selecciona una poblacion</option>
            {towns.map((town) => (
              <option key={town.ineCode} value={town.name}>
                {town.name}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }

  useEffect(() => {
    if (!session || !supabase) return;
    supabase
      .from("profiles")
      .select("display_name, community, province, locality, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(
          data?.display_name || session.user.user_metadata.display_name || "",
        );
        setCommunity(data?.community || "");
        setProvince(data?.province || "");
        setLocality(data?.locality || "");
        setAvatarUrl(data?.avatar_url || "");
      });
  }, [session]);

  async function handleAuthentication(event) {
    event.preventDefault();
    setIsSubmitting(true);
    const options = {
      data: {
        display_name: displayName || email.split("@")[0],
        community,
        province,
        locality,
        avatar_url: avatarUrl || null,
      },
    };
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options });
    setIsSubmitting(false);
    if (result.error) {
      onNotice(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMode("login");
      setPassword("");
      onNotice(
        "Revisa tu email para confirmar la cuenta antes de iniciar sesion.",
      );
    }
    if (result.data.session) onSessionChange(result.data.session);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setIsSubmitting(true);
    const { error } = await supabase.from("profiles").upsert(
      {
        id: session.user.id,
        display_name: displayName || session.user.email.split("@")[0],
        community,
        province,
        locality,
      },
      { onConflict: "id" },
    );
    setIsSubmitting(false);
    onNotice(error ? error.message : "Perfil actualizado.");
  }

  async function uploadAvatar(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onNotice("Selecciona una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onNotice("La foto de perfil no puede superar 5 MB.");
      return;
    }

    setIsUploadingAvatar(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${session.user.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { contentType: file.type, cacheControl: "3600" });
    if (uploadError) {
      setIsUploadingAvatar(false);
      onNotice(`No se pudo subir la foto: ${uploadError.message}`);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", session.user.id);
    setIsUploadingAvatar(false);
    if (profileError) {
      onNotice(`No se pudo actualizar el perfil: ${profileError.message}`);
      return;
    }
    setAvatarUrl(data.publicUrl);
    onNotice("Foto de perfil actualizada.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    onSessionChange(null);
  }

  if (!isSupabaseConfigured)
    return (
      <main className="account-page">
        <h1>Conecta Supabase</h1>
        <p>
          Configura las variables de entorno para activar registro y bibliotecas
          compartidas.
        </p>
      </main>
    );
  if (session)
    return (
      <main className="account-page">
        <p className="eyebrow">
          <UserRound size={14} /> CUENTA
        </p>
        <h1>Tu perfil</h1>
        <p className="account-email">{session.user.email}</p>
        <div className="account-avatar-editor">
          <div className="account-avatar-preview">
            {avatarUrl ? <img src={avatarUrl} alt="Tu foto de perfil" /> : <UserRound size={36} />}
          </div>
          <div>
            <strong>Foto de perfil</strong>
            <span>JPG, PNG o WebP. Maximo 5 MB.</span>
            <label className="avatar-upload-button" htmlFor="avatar-upload">
              <Camera size={16} /> {isUploadingAvatar ? "Subiendo..." : "Cambiar foto"}
            </label>
            <input
              id="avatar-upload"
              className="avatar-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadAvatar}
              disabled={isUploadingAvatar}
            />
          </div>
        </div>
        <form className="account-form" onSubmit={saveProfile}>
          <label>
            Nombre visible
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
          <LocationFields />
          <button className="add-button" disabled={isSubmitting} type="submit">
            <Save size={16} /> Guardar perfil
          </button>
        </form>
        <button type="button" className="account-signout" onClick={signOut}>
          <LogOut size={16} /> Cerrar sesion
        </button>
      </main>
    );
  return (
    <main className="account-page">
      <p className="eyebrow">
        <LogIn size={14} /> ACCESO
      </p>
      <h1>{mode === "login" ? "Entra a tu biblioteca" : "Crea tu cuenta"}</h1>
      <p className="account-copy">
        Guarda tu biblioteca, publica cartas para trade y conecta con tu grupo.
      </p>
      <div className="account-tabs">
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          Iniciar sesion
        </button>
        <button
          type="button"
          className={mode === "signup" ? "active" : ""}
          onClick={() => setMode("signup")}
        >
          Registrarme
        </button>
      </div>
      <form className="account-form" onSubmit={handleAuthentication}>
        {mode === "signup" && (
          <>
            <label>
              Nombre visible
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Como te veran los demas"
                required
              />
            </label>
            <LocationFields />
          </>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Contrasena
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength="6"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        </label>
        <button className="add-button" disabled={isSubmitting} type="submit">
          <LogIn size={16} />{" "}
          {isSubmitting
            ? "Un momento..."
            : mode === "login"
              ? "Iniciar sesion"
              : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}

export default AccountPage;
