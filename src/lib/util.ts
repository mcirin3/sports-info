export function fmtTime(iso: string) {
    const d = new Date(iso); 
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
}