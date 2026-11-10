"use client";
import { useState } from "react";

export type PartyDetails = { name: string; mobile: string; address: string };
export const emptyParty: PartyDetails = { name: "", mobile: "", address: "" };

export function PartyFields({ customer = emptyParty, registeredOwner = emptyParty, samePerson = false }: {
  customer?: PartyDetails; registeredOwner?: PartyDetails; samePerson?: boolean;
}) {
  const [same, setSame] = useState(samePerson);
  return <>
    <fieldset>
      <legend>Booking customer</legend>
      <p>The person making the booking.</p>
      <label>Customer name<input name="customer_name" defaultValue={customer.name} maxLength={150} autoComplete="off" /></label>
      <label>Customer mobile<input name="customer_mobile" defaultValue={customer.mobile} maxLength={30} type="tel" autoComplete="off" /></label>
      <label>Customer address<textarea name="customer_address" defaultValue={customer.address} maxLength={1000} rows={3} autoComplete="off" /></label>
    </fieldset>
    <fieldset>
      <legend>Registered owner</legend>
      <p>The person whose name will appear on the vehicle registration.</p>
      <label><input name="same_person" type="checkbox" checked={same} onChange={event => setSame(event.target.checked)} />Same as booking customer</label>
      {same && <p>The booking customer’s details will be copied when you save.</p>}
      <div hidden={same}>
        <label>Registered owner name<input name="registration_name" defaultValue={registeredOwner.name} maxLength={150} autoComplete="off" disabled={same} /></label>
        <label>Registered owner mobile<input name="registration_mobile" defaultValue={registeredOwner.mobile} maxLength={30} type="tel" autoComplete="off" disabled={same} /></label>
        <label>Registered owner address<textarea name="registration_address" defaultValue={registeredOwner.address} maxLength={1000} rows={3} autoComplete="off" disabled={same} /></label>
      </div>
    </fieldset>
  </>;
}
