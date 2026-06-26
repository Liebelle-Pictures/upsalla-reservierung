-- RLS Policies: Staff-App — nur eingeloggte Benutzer haben Zugriff

-- STANDORTE: alle eingeloggten Benutzer können lesen
CREATE POLICY "Eingeloggte können Standorte lesen"
  ON standorte FOR SELECT
  TO authenticated
  USING (true);

-- LOGEN: alle eingeloggten Benutzer können lesen
CREATE POLICY "Eingeloggte können Logen lesen"
  ON logen FOR SELECT
  TO authenticated
  USING (true);

-- KUNDEN: alle eingeloggten Benutzer können lesen und schreiben
CREATE POLICY "Eingeloggte können Kunden lesen"
  ON kunden FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Eingeloggte können Kunden erstellen"
  ON kunden FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Eingeloggte können Kunden aktualisieren"
  ON kunden FOR UPDATE
  TO authenticated
  USING (true);

-- RESERVIERUNGEN: alle eingeloggten Benutzer können lesen und schreiben
CREATE POLICY "Eingeloggte können Reservierungen lesen"
  ON reservierungen FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Eingeloggte können Reservierungen erstellen"
  ON reservierungen FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Eingeloggte können Reservierungen aktualisieren"
  ON reservierungen FOR UPDATE
  TO authenticated
  USING (true);
