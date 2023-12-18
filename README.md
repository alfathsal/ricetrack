
# Sawtooth Supply Chain

This prototype is a distributed application powered by Hyperledger Sawtooth to track and manage the
supply chain of:
- Rice

The user can easiliy create a product and link it to the blockchain. The user
can track the product by its data such as serial number, location or type. Also,
 administrators can transfer the ownership or possession to an administrator.
 ### User types
 - **Administrator**: 
 This user types manages the product logistics.
 - **Custodian**: 
 This user has the current possession of the product. It can post updates for the product such as temperature or product status.
 - **Owner**: 
 This user owns the product.

## Requirements
- [Docker](https://docs.docker.com/install/)
- [Docker Composer](https://docs.docker.com/compose/install/)
 
## Diagrams
You can find Architectural UML Diagrams [here](https://github.com/CarlosRoldanx/Buxton/tree/master/UML%20Diagrams). 
 
## Use Case
A Rice Milling company can access the prototype and register an administrator. Then,
 an adminsitrator can create a product tracking record. When the product is sent 
 from point A to B, the custodianship of the product can be moved too. The 
 ownership remaind to the owner, and each administrator can update the product
 with the rice state such as temperature or location.
 
 This can be used by the end-user to track the rice or by the rice company to
  track the rice.
  
## Set up
  
Once Docker is installed and you've cloned this repo, navigate to the root
project directory and run:

```bash
docker-compose up
```

This will take awhile the first time it runs, but when complete will be running
all required components in separate containers. Once, the project has composed,
 the prototype will be at **http://localhost:8022**
  

More information in the[sawtooth-core repo](https://github.com/hyperledger/sawtooth-core)or[published docs](https://sawtooth.hyperledger.org/docs/).

