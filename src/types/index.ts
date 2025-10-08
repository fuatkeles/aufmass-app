export interface FormData {
  aufmasser: string;
  montageteam: string;
  kunde: string;
  datum: string;
  anzahlStutzen: string;
  hoheStutzen: string;
  gestellfarbe: string;
  eindeckung: string;
  produkte: string[];
  extras: ExtrasData;
  beschattung: BeschattungData;
  zeichnung: string;
}

export interface ExtrasData {
  statiktrager: string;
  freistehend: string;
  ledBeleuchtung: string;
  fundament: string;
  wasserablauf: string[];
  bauform: string;
  stutzen: string;
}

export interface BeschattungData {
  ancUnterglas: boolean;
  ancAufglas: boolean;
  capri: boolean;
  markise: string;
  breite: string;
  tiefe: string;
  volanTyp: string;
  antrieb: string;
  antriebsseite: string;
}
