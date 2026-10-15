// =============================================================================
// /utenti — codici invito, chi può entrare, password temporanee
// =============================================================================
// Tutti gli utenti hanno gli stessi permessi: chiunque può invitare o disattivare.

import type { Metadata } from "next";
import { Plus, UserX } from "lucide-react";
import { utenteCorrente } from "@/auth";
import { Avatar, Card, CardContent, CardHeader, CardTitle, TitoloPagina } from "@/comune/componenti";
import { BottoneInvio, FormAzione } from "@/comune/moduli";
import { formattaDataOra } from "@/comune/regole";
import { annullaInvito, attivaUtente, creaInvito } from "@/utenti/azioni";
import { codiciAttivi, elencoUtenti } from "@/utenti/database";
import { CodiceInvito, PasswordTemporanea } from "@/utenti/moduli";
import { GIORNI_VALIDITA_INVITO } from "@/utenti/regole";

export const metadata: Metadata = { title: "Utenti" };

export default async function UtentiPage() {
  // Promise.all: le tre letture partono insieme invece che una dopo l'altra.
  const [io, utenti, codici] = await Promise.all([utenteCorrente(), elencoUtenti(), codiciAttivi()]);
  const attivi = utenti.filter((u) => u.attivo);
  const disattivati = utenti.filter((u) => !u.attivo);

  return (
    <div className="grid gap-5">
      <TitoloPagina
        className="mb-0"
        titolo="Utenti"
        sottotitolo="Tutti possono fare tutto. Per far entrare una persona nuova, crea un codice invito e daglielo."
      />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Codici invito</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ogni codice vale per una sola persona e scade dopo {GIORNI_VALIDITA_INVITO} giorni. Chi lo riceve apre il
              programma e tocca “Crea il tuo account”.
            </p>
          </div>
          <FormAzione action={creaInvito}>
            <BottoneInvio size="lg">
              <Plus /> Crea codice invito
            </BottoneInvio>
          </FormAzione>
        </CardHeader>
        <CardContent className="grid gap-3">
          {codici.length === 0 && <p className="text-muted-foreground">Nessun codice in sospeso.</p>}
          {/* Il codice più recente (il primo) è più grande ed evidenziato. */}
          {codici.map((c, i) => (
            <div key={c.id} className="grid gap-2 rounded-xl border p-4 first:border-primary/40 first:bg-primary/5">
              <CodiceInvito codice={c.codice} grande={i === 0} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Creato da {c.creatoDa.name ?? "?"} · vale fino al {formattaDataOra(c.scadeIl)}
                </span>
                <FormAzione
                  action={annullaInvito.bind(null, c.id)}
                  conferma="Annullare questo codice? Non funzionerà più."
                >
                  <BottoneInvio variant="ghost" size="sm" className="text-destructive">
                    Annulla codice
                  </BottoneInvio>
                </FormAzione>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chi può entrare ({attivi.length})</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {attivi.map((u) => {
            const nome = u.name ?? u.email;
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0 last:pb-0">
                <Avatar nome={nome} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-bold">
                    {nome}
                    {u.id === io.id && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Tu</span>
                    )}
                    {u.devoCambiarePassword && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        ha una password temporanea
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{u.email}</div>
                </div>
                {/* Su sé stessi niente bottoni: non ci si può disattivare da soli. */}
                {u.id !== io.id && (
                  <div className="flex flex-wrap items-start gap-2">
                    <PasswordTemporanea utenteId={u.id} nome={nome} />
                    <FormAzione
                      action={attivaUtente.bind(null, u.id, false)}
                      conferma={`Disattivare ${nome}? Non potrà più entrare (i suoi ordini restano).`}
                    >
                      <BottoneInvio variant="outline" size="sm" className="text-destructive">
                        <UserX /> Disattiva
                      </BottoneInvio>
                    </FormAzione>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {disattivati.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Disattivati</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {disattivati.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <Avatar nome={u.name ?? u.email} className="opacity-50" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{u.name ?? u.email}</div>
                  <div className="truncate text-sm">{u.email}</div>
                </div>
                <FormAzione action={attivaUtente.bind(null, u.id, true)}>
                  <BottoneInvio variant="outline" size="sm">
                    Riattiva
                  </BottoneInvio>
                </FormAzione>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
