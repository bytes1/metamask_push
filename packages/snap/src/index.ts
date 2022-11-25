import { OnRpcRequestHandler } from '@metamask/snap-types';
import { ethers, Wallet as EOAWallet } from 'ethers';

type Notfication = {
  feeds: [];
  itemcount: number;
};

async function saveState(newState: never[][]) {
  await wallet.request({
    method: 'snap_manageState',
    params: ['update', { ...newState }],
  });
}
async function getState() {
  const state = await wallet.request({
    method: 'snap_manageState',
    params: ['get'],
  });
  if (state === null) {
    return {};
  }
  return state ?? {};
}
const getEOAAccount = async (): Promise<string> => {
  const accounts: any = await wallet.request({ method: 'eth_accounts' });
  return accounts[0];
};
async function getFeeds() {
  const account = await getEOAAccount();
  if (account) {
    const response = await fetch(
      `https://backend-staging.epns.io/apis/v1/users/eip155:5:${account}/feeds?page=1&limit=10&spam=false`,
    );
    return response.json();
  }
  return null;
}

function filter(data: Notfication) {
  if (data['feeds'].length > 0) {
    const data_1 = data['feeds'].map((a) => [
      a['payload']['data']['sid'],
      a['payload']['data']['app'],
      a['payload']['data']['amsg'],
    ]);
    return data_1;
  }
  return [];
}

export const onCronjob: OnRpcRequestHandler = async ({ origin, request }) => {
  const store_ssid = Object.values(await getState());
  switch (request.method) {
    case 'check':
      console.log('checking notification');
      const notification = filter(await getFeeds());
      const ssid = notification.map((a) => a[0]);
      if (ssid.length > 0 || store_ssid.length > 0) {
        if (JSON.stringify(store_ssid) === JSON.stringify(ssid)) {
          console.log('no new messages');
        } else {
          const push_data = notification.filter(
            (data) => !store_ssid.includes(data[0]),
          );
          if (push_data.length > 0) {
            wallet.request({
              method: 'snap_notify',
              params: [
                {
                  type: 'native',
                  message: `NEW NOTIFICATION:${push_data.length}`,
                },
              ],
            });
            await saveState(ssid);
          }
          if (push_data.length > 1) {
            let string = '';
            for (let i = 0; i < push_data.length; i++) {
              string =
                string +
                `========================\nChannel Name:${push_data[i][1]} \n Message: ${push_data[i][2]} \n`;
            }
            const data = await wallet.request({
              method: 'snap_confirm',
              params: [
                {
                  prompt: 'NEW NOTIFICATIONS RECEIVED',
                  description:
                    'This custom confirmation is just for display purposes.',
                  textAreaContent: `${string}`,
                },
              ],
            });
          }
          console.log(push_data);
          if (push_data.length === 1) {
            const data = await wallet.request({
              method: 'snap_notify',
              params: [
                {
                  type: 'inApp',
                  message: `${push_data[0][2]}`,
                },
              ],
            });
          }
        }
      }
      break;
    default:
      throw new Error('Method not found.');
  }
};
