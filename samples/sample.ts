// Original function
interface UserData {
    first_name: string;
    last_name: string;
    age: number;
    country: string;
    subscription: string;
    email: string;
  }
  
  function processUserData(users: UserData[]): Partial<UserData>[] {
    const result: Partial<UserData>[] = [];
    for (const user of users) {
      if (user.age >= 18) {
        if (user.country === 'US') {
          if (user.subscription === 'premium') {
            const name = user.first_name + ' ' + user.last_name;
            result.push({ name, email: user.email, age: user.age });
          } else {
            console.log(`User ${user.first_name} ${user.last_name} is not a premium subscriber`);
          }
        } else {
          console.log(`User ${user.first_name} ${user.last_name} is not from the US`);
        }
      } else {
        console.log(`User ${user.first_name} ${user.last_name} is under 18`);
      }
    }
    return result;
  }
  