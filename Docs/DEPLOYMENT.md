# Tiikii Festival Server - Free Deployment Guide

This guide covers deploying your Tiikii Festival API server to free hosting platforms.

## Prerequisites

1. **GitHub Repository**: Push your code to GitHub
2. **Environment Variables**: Set up production environment variables
3. **Database**: SQLite database will be created automatically

## Free Deployment Options

### 1. Render (Recommended)

**Why Render?**
- Perfect for Node.js APIs with databases
- 750 free hours/month (24/7 for small apps)
- Automatic deployments from GitHub
- Built-in SSL and environment management

**Deployment Steps:**

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy on Render**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub
   - Click "New +" → "Web Service"
   - Connect your repository
   - Use these settings:
     - **Name**: `tiikii-festival-api`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free

3. **Set Environment Variables**
   - Go to your service → Environment
   - Add these variables:
     ```
     NODE_ENV=production
     PORT=3000
     JWT_SECRET=your-super-secret-jwt-key-here
     DB_PATH=/opt/render/project/src/database/tiikii_festival.db
     CLIENT_URL=https://your-frontend-domain.com
     ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Your API will be available at: `https://your-app-name.onrender.com`

### 2. Railway

**Why Railway?**
- $5 monthly credit (usually enough for small apps)
- Excellent developer experience
- Automatic deployments

**Deployment Steps:**

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Deploy**
   ```bash
   railway login
   railway init
   railway up
   ```

3. **Set Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set JWT_SECRET=your-super-secret-jwt-key-here
   railway variables set CLIENT_URL=https://your-frontend-domain.com
   ```

### 3. Heroku (Paid but Reliable)

**Why Heroku?**
- Very reliable and well-documented
- Easy deployment process
- Hobby plan: $5-7/month

**Deployment Steps:**

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Deploy**
   ```bash
   heroku create your-app-name
   git push heroku main
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your-super-secret-jwt-key-here
   heroku config:set CLIENT_URL=https://your-frontend-domain.com
   ```

## Environment Variables

Create a `.env` file for local development (copy from `.env.example`):

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
DB_PATH=./database/tiikii_festival.db
CLIENT_URL=http://localhost:3000
```

**Important**: Never commit `.env` files to version control!

## Database Setup

The SQLite database will be created automatically on first run. For production:

1. **Local Setup** (for testing):
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

2. **Production**: Database is created automatically when the server starts

## Testing Your Deployment

1. **Health Check**: `GET https://your-app-url/health`
2. **API Endpoints**: `GET https://your-app-url/api/festivals`
3. **Socket.IO**: Test real-time features

## Troubleshooting

### Common Issues:

1. **Build Failures**
   - Check Node.js version (requires >=16.0.0)
   - Ensure all dependencies are in `package.json`

2. **Database Issues**
   - Verify `DB_PATH` environment variable
   - Check file permissions

3. **Environment Variables**
   - Ensure all required variables are set
   - Check variable names match exactly

4. **Port Issues**
   - Most platforms use `PORT` environment variable
   - Don't hardcode port numbers

### Logs and Debugging:

- **Render**: Check logs in dashboard
- **Railway**: Use `railway logs`
- **Heroku**: Use `heroku logs --tail`

## Security Considerations

1. **JWT Secret**: Use a strong, random secret
2. **CORS**: Update `CLIENT_URL` for production
3. **Rate Limiting**: Already configured in your server
4. **HTTPS**: All platforms provide SSL certificates

## Cost Comparison

| Platform | Free Tier | Paid Plans | Best For |
|----------|-----------|------------|----------|
| Render | 750 hours/month | $7+/month | Node.js APIs |
| Railway | $5 credit/month | $5+/month | Full-stack apps |
| Heroku | None | $5+/month | Production apps |
| Fly.io | $5 credit | $5+/month | High performance |

## Next Steps

1. Choose a platform (Render recommended)
2. Set up your GitHub repository
3. Deploy using the steps above
4. Test your API endpoints
5. Update your frontend to use the new API URL
6. Set up monitoring and logging

## Support

- **Render**: [docs.render.com](https://docs.render.com)
- **Railway**: [docs.railway.app](https://docs.railway.app)
- **Heroku**: [devcenter.heroku.com](https://devcenter.heroku.com)
